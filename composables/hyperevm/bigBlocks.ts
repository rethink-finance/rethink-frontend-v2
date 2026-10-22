import { ethers } from "ethers";
import {
  APPROVE_AGENT_FIELDS,
  APPROVE_AGENT_PRIMARY_TYPE,
  approveAgentAction,
  evmUserModifyAction,
  signL1Action,
  splitSignature,
  typedDataRequest,
  userSignedTypedData,
  type IApproveAgentAction,
  type IHyperCoreSignature,
} from "~/composables/hyperevm/hyperCoreSigning";
import { BLOCK_SHARE } from "~/composables/permissions/gasLimit";
import {
  normalizeSignatureV,
  type IEip1193Provider,
} from "~/composables/safe/safeTransactionService";
import { describeRailError, type IRailStep } from "~/composables/useTransactionRail";
import { ChainId } from "~/types/enums/chain_id";

/**
 * HyperEVM big blocks, switched from inside the app.
 *
 * HyperEVM mines two kinds of block: a standard one every second, with room
 * for 3,000,000 gas, and a big one about once a minute, with room for
 * 30,000,000. Each address's transactions go to one kind only — standard,
 * unless the address has opted into big blocks on Hyperliquid — so a
 * transaction that needs more than a standard block holds (initCreateFund,
 * ~4.65M; a large permissions save) is never mined from an address that has
 * not opted in, whatever gas limit it carries.
 *
 * The opt-in is a Hyperliquid exchange action, evmUserModify, not a HyperEVM
 * transaction: gasless, but signed the "L1" way, which a browser wallet
 * cannot do (hyperCoreSigning.ts). So each switch does what the toggle at
 * hyperevm-block-toggle.vercel.app does:
 *   1. makes a throwaway agent key inside the page,
 *   2. has the wallet approve it under a name of its own (signature one),
 *   3. signs evmUserModify with it,
 *   4. has the wallet remove it again (signature two).
 * The key is never stored and is gone with the page. While approved it could
 * trade the wallet's Hyperliquid account but never withdraw from it, and its
 * own name keeps it out of the unnamed slot Hyperliquid's app uses.
 *
 * A rail that sends such a transaction switches the sender to big blocks
 * first and back afterwards. Big blocks come about once a minute, so an
 * address left on them waits that long for every later transaction too.
 * An address that was already on big blocks before the app touched it is
 * left there.
 *
 * Checked against the live exchange on 2026-10-22 with a throwaway key: it
 * recovers the signer from both kinds of signature built here, and refuses
 * an address that has never deposited ("Must deposit before performing
 * actions") — a wallet needs a Hyperliquid account to switch at all.
 */

export const HYPERLIQUID_EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

/**
 * HyperEVM RPCs that answer eth_usingBigBlocks (checked 2026-10-22). The
 * first of the app's HyperEVM RPCs, purroofgroup, answers "Method not found".
 */
export const BIG_BLOCK_STATUS_RPC_URLS = [
  "https://rpc.hyperliquid.xyz/evm",
  "https://rpc.hypurrscan.io",
];

/** For a sender the app cannot switch: a Safe's owner, switching for themselves. */
export const HYPEREVM_BIG_BLOCK_TOGGLE_URL = "https://hyperevm-block-toggle.vercel.app/";

/** A standard HyperEVM block, for when the chain cannot be asked. */
export const HYPEREVM_STANDARD_BLOCK_GAS = 3_000_000;

const RPC_TIMEOUT_MS = 10_000;

/**
 * Does a transaction with this gas limit outgrow a standard block? The same
 * share of the block a single transaction may take as everywhere else in
 * the app (gasLimit.ts).
 */
export const exceedsStandardBlock = (
  gas: number,
  standardBlockGasLimit: number = HYPEREVM_STANDARD_BLOCK_GAS,
): boolean => gas > Math.floor(standardBlockGasLimit * BLOCK_SHARE);

/** One JSON-RPC call over BIG_BLOCK_STATUS_RPC_URLS; undefined when none answers. */
const statusRpc = async (
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> => {
  for (const url of BIG_BLOCK_STATUS_RPC_URLS) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
      const json = await response.json();
      if (!json.error && json.result !== undefined) return json.result;
    } catch (error) {
      console.warn(`${method} failed on ${url}`, error);
    }
  }
  return undefined;
};

/** Is `address` on big blocks? Undefined when no RPC could say. */
export const fetchUsingBigBlocks = async (
  address: string,
  fetchImpl?: typeof fetch,
): Promise<boolean | undefined> => {
  const result = await statusRpc("eth_usingBigBlocks", [address], fetchImpl);
  return typeof result === "boolean" ? result : undefined;
};

/**
 * Code an EIP-7702 account carries: a pointer to its delegate, behind which
 * there is still a key that can sign.
 */
const EIP7702_DELEGATION_PREFIX = "0xef0100";

/**
 * Is `address` a contract — a Safe connected through WalletConnect, say?
 * Hyperliquid only takes ECDSA signatures, so a contract cannot be switched
 * from here. Undefined when no RPC could say.
 */
export const fetchIsContract = async (
  address: string,
  fetchImpl?: typeof fetch,
): Promise<boolean | undefined> => {
  const code = await statusRpc("eth_getCode", [address, "latest"], fetchImpl);
  if (typeof code !== "string") return undefined;
  return code !== "0x" && !code.toLowerCase().startsWith(EIP7702_DELEGATION_PREFIX);
};

/* ---- Addresses this app switched on --------------------------------------- */

const SWITCHED_ON_STORAGE_KEY = "hyperevmBigBlocksSwitchedOn";

/**
 * Who this app put on big blocks and has not switched back yet. Kept across
 * reloads, so a rail closed halfway does not leave the wallet on big blocks
 * for good: the next rail sees the app's own switch and still ends with the
 * switch back. Anyone on big blocks without an entry here chose it
 * themselves, and is left alone.
 */
const readSwitchedOn = (): string[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(SWITCHED_ON_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.map(String) : [];
  } catch {
    return [];
  }
};

const rememberSwitchedOn = (address: string, switchedOn: boolean) => {
  const key = address.toLowerCase();
  const others = readSwitchedOn().filter((entry) => entry !== key);
  try {
    localStorage.setItem(
      SWITCHED_ON_STORAGE_KEY,
      JSON.stringify(switchedOn ? [...others, key] : others),
    );
  } catch (error) {
    console.warn("Could not record the big-block switch", error);
  }
};

const wasSwitchedOnByApp = (address: string) =>
  readSwitchedOn().includes(address.toLowerCase());

/* ---- Deciding ------------------------------------------------------------- */

/**
 * What a rail does about block size:
 *  - "none": nothing — not HyperEVM, or everything fits a standard block;
 *  - "switch": switch to big blocks first, and back after;
 *  - "already-on": the sender chose big blocks themselves; send as it is;
 *  - "contract": the sender cannot sign for Hyperliquid (a Safe), so whoever
 *    executes for it has to have switched their own address.
 */
export type BigBlockPlan = "none" | "switch" | "already-on" | "contract";

export const planBigBlocks = async (
  chainId: ChainId,
  sender: string | undefined,
  needsBigBlocks: boolean,
  fetchImpl?: typeof fetch,
): Promise<BigBlockPlan> => {
  if (chainId !== ChainId.HYPEREVM || !needsBigBlocks || !sender) return "none";
  const [usingBigBlocks, isContract] = await Promise.all([
    fetchUsingBigBlocks(sender, fetchImpl),
    fetchIsContract(sender, fetchImpl),
  ]);
  if (isContract) return "contract";
  // Unknown counts as off: switching on is harmless when it was on already.
  if (usingBigBlocks && !wasSwitchedOnByApp(sender)) return "already-on";
  return "switch";
};

/* ---- Switching ------------------------------------------------------------ */

/**
 * The exchange's refusal, in a line a person can act on. It answers HTTP 200
 * with {status: "err", response: "<reason>"}; a body it cannot read comes
 * back as plain text.
 */
export const describeExchangeError = (body: unknown): string => {
  const reason = String(
    (body as { response?: unknown } | undefined)?.response ?? body ?? "",
  ).trim();
  if (/must deposit before performing actions/i.test(reason)) {
    return (
      "Hyperliquid only accepts this from a wallet that has deposited on " +
      "Hyperliquid before. Deposit any amount to this wallet on " +
      "app.hyperliquid.xyz, then try again."
    );
  }
  return reason
    ? `Hyperliquid refused the request: ${reason}`
    : "Hyperliquid did not answer the request.";
};

const EXCHANGE_TIMEOUT_MS = 15_000;

/** Post a signed action; resolves when the exchange says "ok". */
export const postExchangeAction = async (
  action: object,
  nonce: number,
  signature: IHyperCoreSignature,
  fetchImpl: typeof fetch = fetch,
): Promise<void> => {
  const response = await fetchImpl(HYPERLIQUID_EXCHANGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, nonce, signature, vaultAddress: null }),
    signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Plain text: an error message of its own.
  }
  if ((body as { status?: unknown } | undefined)?.status === "ok") return;
  throw new Error(describeExchangeError(body));
};

let lastNonce = 0;

/** Milliseconds, the way Hyperliquid wants nonces, never the same one twice. */
const nextNonce = () => (lastNonce = Math.max(Date.now(), lastNonce + 1));

/**
 * The wallet signs an approveAgent. Verified locally before it is posted,
 * as signSafeTx does: a wallet that signs with another account would
 * otherwise only fail at the exchange, with a stranger's address.
 */
const signApproveAgent = async (
  provider: IEip1193Provider,
  from: string,
  action: IApproveAgentAction,
  signatureChainId: number,
): Promise<IHyperCoreSignature> => {
  const typedData = userSignedTypedData(
    APPROVE_AGENT_PRIMARY_TYPE,
    APPROVE_AGENT_FIELDS,
    { ...action },
    signatureChainId,
  );
  const raw = await provider.request({
    method: "eth_signTypedData_v4",
    params: [from, JSON.stringify(typedDataRequest(typedData))],
  });
  const signature = normalizeSignatureV(String(raw));
  const signedBy = ethers.verifyTypedData(
    typedData.domain,
    typedData.types,
    typedData.message,
    signature,
  );
  if (signedBy.toLowerCase() !== from.toLowerCase()) {
    throw new Error(
      `The wallet signed as ${signedBy}, not as the connected account ${from}.`,
    );
  }
  return splitSignature(signature);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hyperliquid applies a switch a moment after accepting it. Wait until the
 * chain reports it, so the transaction that needs it is not sent too early.
 */
const waitForBlockSize = async (
  address: string,
  usingBigBlocks: boolean,
  timeoutMs: number,
  intervalMs: number,
  fetchImpl?: typeof fetch,
) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const current = await fetchUsingBigBlocks(address, fetchImpl);
    // No RPC can say: the exchange accepted it, and there is nothing to
    // check it against.
    if (current === undefined || current === usingBigBlocks) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `Hyperliquid accepted the switch, but HyperEVM still has this wallet on ${
          usingBigBlocks ? "standard" : "big"
        } blocks. Wait a moment and try again.`,
      );
    }
    await sleep(intervalMs);
  }
};

export interface ISwitchBigBlocksOptions {
  provider: IEip1193Provider;
  /** The connected wallet, whose HyperEVM transactions move. */
  address: string;
  usingBigBlocks: boolean;
  /** Both signatures are in; what is left is Hyperliquid applying it. */
  onSigned?: () => void;
  fetchImpl?: typeof fetch;
  confirmTimeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Switch `address` to big blocks or back. Asks the wallet for two
 * signatures (no gas), then waits for HyperEVM to report the new size.
 * Nothing is signed when the address is on that size already, so a retry
 * after the switch went through costs nothing.
 *
 * Resolves `{ agentRemoved: false }` when the switch went through but the
 * temporary agent could not be taken off again — harmless, since nobody
 * holds its key, but it keeps one of the account's named API-wallet slots.
 */
export const switchBigBlocks = async ({
  provider,
  address,
  usingBigBlocks,
  onSigned,
  fetchImpl,
  confirmTimeoutMs = 30_000,
  pollIntervalMs = 1_000,
}: ISwitchBigBlocksOptions): Promise<{ agentRemoved: boolean }> => {
  if ((await fetchUsingBigBlocks(address, fetchImpl)) === usingBigBlocks) {
    // Already on is no news about who switched it; already off is the end
    // of the app's switch, if there was one.
    if (!usingBigBlocks) rememberSwitchedOn(address, false);
    onSigned?.();
    return { agentRemoved: true };
  }

  const from = ethers.getAddress(address);
  // Any chain will do for Hyperliquid; the wallet's own avoids a refusal
  // over a mismatch, and the action records which it was.
  const signatureChainId = Number(await provider.request({ method: "eth_chainId" }));
  const agent = ethers.Wallet.createRandom();
  const agentName = `rethink-${ethers.hexlify(ethers.randomBytes(3)).slice(2)}`;

  const approve = approveAgentAction(agent.address, agentName, nextNonce(), signatureChainId);
  await postExchangeAction(
    approve,
    approve.nonce,
    await signApproveAgent(provider, from, approve, signatureChainId),
    fetchImpl,
  );

  let switchError: unknown;
  try {
    const nonce = nextNonce();
    const action = evmUserModifyAction(usingBigBlocks);
    await postExchangeAction(action, nonce, await signL1Action(agent, action, nonce), fetchImpl);
    if (usingBigBlocks) rememberSwitchedOn(address, true);
  } catch (error) {
    switchError = error;
  }

  // Taken off whether or not the switch went through, while the wallet is
  // still at hand. Declining it is the reader's call, not a failure.
  let agentRemoved = false;
  try {
    const remove = approveAgentAction(ethers.ZeroAddress, agentName, nextNonce(), signatureChainId);
    await postExchangeAction(
      remove,
      remove.nonce,
      await signApproveAgent(provider, from, remove, signatureChainId),
      fetchImpl,
    );
    agentRemoved = true;
  } catch (error) {
    console.warn(`Could not remove the temporary Hyperliquid agent ${agentName}`, error);
  }

  if (switchError) throw switchError;
  onSigned?.();
  await waitForBlockSize(address, usingBigBlocks, confirmTimeoutMs, pollIntervalMs, fetchImpl);
  if (!usingBigBlocks) rememberSwitchedOn(address, false);
  return { agentRemoved };
};

/* ---- On a rail ------------------------------------------------------------ */

/** Why a rail has the two extra steps, for the top of its dialog. */
export const BIG_BLOCKS_INTRO =
  "This needs more gas than a standard HyperEVM block holds, so your wallet " +
  "switches to HyperEVM's big blocks for it, and back again afterwards.";

const SWITCH_HINTS = {
  wallet:
    "Sign twice in your wallet: once to let this page switch your block " +
    "size, once to take that permission back. Neither costs gas.",
  confirming: "Waiting for HyperEVM to apply the switch.",
};

/** While a transaction that needed big blocks waits for one. */
const BIG_BLOCK_CONFIRMING_HINT =
  "Sent. Big blocks come about once a minute, so this can take a minute to confirm.";

/**
 * `steps` between a switch to big blocks and a switch back, for a sender
 * planBigBlocks answered "switch" for. A switch back that fails says what
 * staying on big blocks means, since everything before it went through.
 */
export const withBigBlockSwitch = (
  steps: IRailStep[],
  provider: IEip1193Provider,
  address: string,
  onAgentLeft: () => void,
): IRailStep[] => {
  const switchTo = async (usingBigBlocks: boolean, submitted: () => void) => {
    const { agentRemoved } = await switchBigBlocks({
      provider,
      address,
      usingBigBlocks,
      onSigned: submitted,
    });
    if (!agentRemoved) onAgentLeft();
  };

  return [
    {
      label: "Turn on big blocks for your wallet",
      hint: SWITCH_HINTS,
      run: (submitted) => switchTo(true, submitted),
    },
    ...steps.map((step) => ({
      ...step,
      hint: { confirming: BIG_BLOCK_CONFIRMING_HINT, ...step.hint },
    })),
    {
      label: "Turn big blocks off again",
      hint: SWITCH_HINTS,
      run: async (submitted) => {
        try {
          await switchTo(false, submitted);
        } catch (error) {
          const reason = describeRailError(error);
          throw new Error(
            `${/[.!?]$/.test(reason) ? reason : `${reason}.`} Until big blocks ` +
              "are off, every HyperEVM transaction from this wallet waits for " +
              "one, about a minute each.",
          );
        }
      },
    },
  ];
};

/** Shown when the agent outlived its switch (see switchBigBlocks). */
export const AGENT_LEFT_WARNING =
  "Block size switched. The temporary key it used is still listed on your " +
  "Hyperliquid account. Nobody holds that key, so it cannot be used, but it " +
  "takes one of your API-wallet slots until you remove it on " +
  "app.hyperliquid.xyz/API.";
