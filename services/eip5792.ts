/**
 * EIP-5792 call batching, spoken straight to the wallet's EIP-1193 provider.
 *
 * The deposit flow's first three transactions — requestDeposit on the vault,
 * approve on the base token, delegate on the votes token — all read
 * msg.sender, so no on-chain router can merge them: routed calls arrive from
 * the router. A wallet that supports `wallet_sendCalls` merges them anyway,
 * because it executes the batch from the depositor's own account (a smart
 * account, or an EOA upgraded in place via EIP-7702) — one confirmation, one
 * transaction, msg.sender intact in every call.
 *
 * Nothing here may assume the wallet cooperates. Capability discovery decides
 * whether batching is offered at all, and every error the wallet can answer
 * with maps to one of three reactions the caller acts on: the user said no,
 * the wallet cannot batch (fall back to per-transaction sends), or something
 * actually failed. The spec settled on numeric status codes and a `{ id }`
 * result late in its life; wallets that shipped earlier report string
 * statuses and a bare id string, so both dialects are normalized here rather
 * than in every caller.
 */

/** The one method this module needs from web3-onboard's wallet provider. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
}

export interface WalletBatchCall {
  to: string;
  data?: string;
  value?: string;
}

/**
 * "supported": the account already executes batches atomically.
 * "ready": it can, after an upgrade the wallet will offer inside the
 * confirmation (EIP-7702); the user may still refuse it there.
 */
export type AtomicBatchStatus = "supported" | "ready" | "unsupported";

/** Chain ids compare as numbers — "0x89" and "0x0089" name the same chain. */
const parseChainKey = (chainId: string): bigint | undefined => {
  try {
    return BigInt(chainId);
  } catch {
    return undefined;
  }
};

/**
 * What a `wallet_getCapabilities` answer says about atomic batching on one
 * chain. Split from the request so the parsing is unit-testable.
 */
export const parseAtomicBatchStatus = (
  capabilities: unknown,
  chainId: string,
): AtomicBatchStatus => {
  const wanted = parseChainKey(chainId);
  if (wanted === undefined || !capabilities || typeof capabilities !== "object") {
    return "unsupported";
  }
  for (const [key, chainCapabilities] of Object.entries(capabilities)) {
    if (parseChainKey(key) !== wanted) continue;
    const status = (chainCapabilities as any)?.atomic?.status;
    if (status === "supported" || status === "ready") return status;
  }
  return "unsupported";
};

export const getAtomicBatchStatus = async (
  provider: Eip1193Provider,
  account: string,
  chainId: string,
): Promise<AtomicBatchStatus> => {
  try {
    // Asks for every chain rather than passing the optional chain filter:
    // early implementations disagree about the second parameter, and the
    // answer is filtered locally either way.
    const capabilities = await provider.request({
      method: "wallet_getCapabilities",
      params: [account],
    });
    return parseAtomicBatchStatus(capabilities, chainId);
  } catch (error) {
    // A wallet whose RPC endpoint is failing rejects this probe like any
    // other request. That verdict is about the endpoint, not about batching —
    // swallowing it as "unsupported" would send the caller down the
    // per-transaction path, which dies on the same endpoint with a worse
    // error. Observed with MetaMask's circuit breaker on Arbitrum.
    if (isWalletRpcHealthError(error)) throw error;
    // Wallets without the method throw on it, which is a complete answer.
    return "unsupported";
  }
};

/**
 * Submit a batch and return its bundle id. `atomicRequired` because the
 * batch pairs a request with the approval that funds it — half of it landing
 * alone is worse than none of it.
 */
export const sendWalletCalls = async (
  provider: Eip1193Provider,
  {
    chainId,
    from,
    calls,
  }: { chainId: string; from: string; calls: WalletBatchCall[] },
): Promise<string> => {
  const result = await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0.0",
        chainId,
        from,
        atomicRequired: true,
        calls,
      },
    ],
  });
  const batchId = typeof result === "string" ? result : result?.id;
  if (typeof batchId !== "string" || !batchId) {
    throw new Error("The wallet returned no call bundle id.");
  }
  return batchId;
};

/**
 * Final-spec codes: 100 pending, 200 confirmed without reverts, 400 failed
 * off chain, 500 reverted, 600 partially reverted. Pre-final wallets report
 * strings instead; anything unrecognizable counts as pending and is left to
 * the poll timeout, since guessing a terminal state ends the wait forever.
 */
export const normalizeCallsStatus = (status: unknown): number => {
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    const legacy: Record<string, number> = {
      PENDING: 100,
      CONFIRMED: 200,
      FAILED: 500,
    };
    return legacy[status.toUpperCase()] ?? 100;
  }
  return 100;
};

export interface WalletCallsResult {
  statusCode: number;
  receipts: any[];
  raw: any;
}

export const getWalletCallsStatus = async (
  provider: Eip1193Provider,
  batchId: string,
): Promise<WalletCallsResult> => {
  const raw = await provider.request({
    method: "wallet_getCallsStatus",
    params: [batchId],
  });
  return {
    statusCode: normalizeCallsStatus(raw?.status),
    receipts: raw?.receipts ?? [],
    raw,
  };
};

export class WalletCallsTimeoutError extends Error {
  constructor(batchId: string) {
    super(`Timed out waiting for call bundle ${batchId} to confirm.`);
  }
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll until the bundle reaches a terminal state. A just-submitted id can be
 * momentarily unknown to the wallet, so single status errors are tolerated;
 * only three in a row count as a real failure.
 */
export const waitForWalletCalls = async (
  provider: Eip1193Provider,
  batchId: string,
  { timeoutMs = 300_000, pollIntervalMs = 2_500 } = {},
): Promise<WalletCallsResult> => {
  const startedAt = Date.now();
  let consecutiveErrors = 0;
  for (;;) {
    try {
      const result = await getWalletCallsStatus(provider, batchId);
      consecutiveErrors = 0;
      if (result.statusCode >= 200) return result;
    } catch (error) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) throw error;
    }
    if (Date.now() - startedAt >= timeoutMs) {
      throw new WalletCallsTimeoutError(batchId);
    }
    await sleep(pollIntervalMs);
  }
};

/**
 * 200 already means "included without reverts" per the spec; the receipts are
 * checked anyway because that guarantee is exactly the part pre-final wallets
 * differ on.
 */
export const isWalletCallsSuccess = (result: WalletCallsResult): boolean => {
  if (result.statusCode !== 200) return false;
  return result.receipts.every((receipt: any) => {
    const status = receipt?.status;
    return (
      status === undefined ||
      status === "0x1" ||
      status === 1 ||
      status === 1n ||
      status === true
    );
  });
};

/** Providers wrap errors unevenly; the code can sit one level down. */
const errorCodeOf = (error: any): number | undefined => {
  const code = error?.code ?? error?.error?.code ?? error?.data?.code;
  return typeof code === "number" ? code : undefined;
};

/** The human-readable detail moves around the same way the code does. */
const errorMessageOf = (error: any): string =>
  [error?.message, error?.error?.message, error?.data?.message]
    .filter((part) => typeof part === "string")
    .join(" | ");

/**
 * The wallet's own RPC endpoint for the chain is down, rate-limited, or out
 * of quota. Seen as MetaMask's circuit breaker ("RPC endpoint returned too
 * many errors, retrying in N minutes") and as provider quota walls ("You've
 * reached the usage limit for your current plan" — 1rpc). The remedy belongs
 * to the user (wait it out, or point the wallet's network at a different
 * RPC), so callers should say that instead of a generic failure. Matched on
 * the message: the codes seen so far (-32603, -32002) are catch-alls that
 * plenty of unrelated failures also wear.
 */
export const isWalletRpcHealthError = (error: any): boolean =>
  /too many errors|circuit break|consider using a different rpc|reached the usage limit|rate.?limit/i.test(
    errorMessageOf(error),
  );

/**
 * What to tell the user when isWalletRpcHealthError says the wallet's
 * endpoint is the problem. One string, because the same verdict can surface
 * from the batch path and from every plain send in the flow, and the user
 * should read the same advice everywhere.
 */
export const WALLET_RPC_HEALTH_MESSAGE =
  "Your wallet's RPC endpoint for this network is failing. Wait a minute and try again, or switch the network's RPC endpoint in your wallet settings.";

/**
 * The user said no to the confirmation itself. 4001 is the EIP-1193 code;
 * 100 is kept because the app's existing send handlers treat it as the same
 * answer (see handleError in the settlement components).
 */
export const isUserRejectionError = (error: any): boolean => {
  const code = errorCodeOf(error);
  return code === 4001 || code === 100;
};

/**
 * EIP-5792 code 5750: the wallet could batch after an account upgrade, and
 * the user refused the upgrade — not the deposit. The right reaction is the
 * per-transaction flow, not an error.
 */
export const isUpgradeRejectionError = (error: any): boolean =>
  errorCodeOf(error) === 5750;

/**
 * The wallet cannot run this batch at all: no such method (-32601 / -32004),
 * unsupported capability (5700), unsupported chain (5710), or a bundle it
 * considers too large (5740). All of them mean "send the transactions one by
 * one instead".
 */
export const isBatchUnsupportedError = (error: any): boolean => {
  const code = errorCodeOf(error);
  if (code === undefined) {
    return /method.+(not (found|supported|available)|does not exist)/i.test(
      errorMessageOf(error),
    );
  }
  return [-32601, -32004, 5700, 5710, 5740].includes(code);
};
