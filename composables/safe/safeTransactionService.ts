import { ethers } from "ethers";
import { ChainId } from "~/types/enums/chain_id";

/**
 * Proposing transactions to a Safe from the app.
 *
 * A Safe that is a member of a vault's Roles modifier (the CRT payout Safe,
 * for one) cannot press an execute button: its transactions have to be
 * proposed, signed by enough owners and then executed. Safe{Wallet} does the
 * signing and executing, and this module does the proposing, so nobody has
 * to carry calldata across to the Transaction Builder by hand.
 *
 * Two ways in, both ending in the same queue:
 *  - An OWNER of the Safe is connected. The app builds the Safe transaction,
 *    has the owner sign its EIP-712 hash (a gasless signature, not a send)
 *    and files it with Safe's hosted Transaction Service, which is what
 *    Safe{Wallet} reads its queue from. The remaining owners confirm and
 *    execute there.
 *  - The SAFE ITSELF is connected — Safe{Wallet} paired over WalletConnect,
 *    or the app opened inside Safe{Wallet} as a Safe App. Its provider turns
 *    a plain eth_sendTransaction into that same proposal, so callers just
 *    send from the Safe's address. The status helpers here still apply.
 *
 * Verified against the HyperEVM service on 2026-09-10: no API key, CORS open,
 * and the hash below reproduces the service's own safeTxHash for the payout
 * Safe's executed proposals (see the test).
 */

/** Safe's hosted Transaction Service per chain (`safe-config.safe.global`). */
export const SAFE_TX_SERVICE_URLS: Partial<Record<ChainId, string>> = {
  [ChainId.ETHEREUM]: "https://api.safe.global/tx-service/eth",
  [ChainId.ARBITRUM]: "https://api.safe.global/tx-service/arb1",
  [ChainId.BASE]: "https://api.safe.global/tx-service/base",
  [ChainId.POLYGON]: "https://api.safe.global/tx-service/pol",
  [ChainId.HYPEREVM]: "https://api.safe.global/tx-service/hyper",
};

/** The chain prefix Safe{Wallet} puts in its URLs (EIP-3770 short names). */
export const SAFE_WALLET_CHAIN_PREFIX: Partial<Record<ChainId, string>> = {
  [ChainId.ETHEREUM]: "eth",
  [ChainId.ARBITRUM]: "arb1",
  [ChainId.BASE]: "base",
  [ChainId.POLYGON]: "matic",
  [ChainId.HYPEREVM]: "hyper-evm",
};

export const SAFE_WALLET_URL = "https://app.safe.global";

/** A Safe transaction as the contract hashes it (v1.3.0+ EIP-712 layout). */
export interface ISafeTx {
  to: string;
  value: string;
  data: string;
  operation: 0 | 1;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
}

export interface ISafeTxStatus {
  safeTxHash: string;
  nonce: number;
  /** Owners who have signed so far. */
  confirmations: number;
  confirmationsRequired: number;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  /** The on-chain hash, once executed. */
  transactionHash: string | null;
}

export interface ISafeInfo {
  address: string;
  nonce: number;
  threshold: number;
  owners: string[];
  version: string;
}

/** Anything EIP-1193 shaped: the connected wallet's provider. */
export interface IEip1193Provider {
  request(args: { method: string; params?: any[] }): Promise<any>;
}

export const SAFE_TX_TYPES = {
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
};

const EIP712_DOMAIN_TYPE = [
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

const serviceUrl = (chainId: ChainId): string => {
  const url = SAFE_TX_SERVICE_URLS[chainId];
  if (!url) {
    throw new Error(`No Safe transaction service is known for chain ${chainId}.`);
  }
  return url;
};

/**
 * Safe{Wallet}'s page for a Safe — its queue, or one transaction of it when
 * a Safe transaction hash is given.
 */
export const safeWalletUrl = (
  chainId: ChainId,
  safeAddress: string,
  safeTxHash?: string,
): string => {
  const prefix = SAFE_WALLET_CHAIN_PREFIX[chainId];
  const safe = ethers.getAddress(safeAddress);
  const target = prefix ? `${prefix}:${safe}` : safe;
  if (safeTxHash) {
    return `${SAFE_WALLET_URL}/transactions/tx?safe=${target}&id=multisig_${safe}_${safeTxHash}`;
  }
  return `${SAFE_WALLET_URL}/transactions/queue?safe=${target}`;
};

/**
 * A Safe transaction for `call` at `nonce`, with the gas refund fields
 * zeroed the way Safe{Wallet} files its own proposals — the executor pays.
 */
export const buildSafeTx = (
  call: { to: string; data?: string; value?: string | bigint; operation?: 0 | 1 },
  nonce: number,
): ISafeTx => ({
  to: ethers.getAddress(call.to),
  value: BigInt(call.value ?? 0).toString(),
  data: call.data && call.data !== "0x" ? call.data : "0x",
  operation: call.operation ?? 0,
  safeTxGas: "0",
  baseGas: "0",
  gasPrice: "0",
  gasToken: ethers.ZeroAddress,
  refundReceiver: ethers.ZeroAddress,
  nonce,
});

export const safeTxDomain = (chainId: ChainId, safeAddress: string) => ({
  chainId: Number(BigInt(chainId)),
  verifyingContract: ethers.getAddress(safeAddress),
});

/** The hash the owners sign and the service files the proposal under. */
export const safeTxHash = (
  chainId: ChainId,
  safeAddress: string,
  tx: ISafeTx,
): string =>
  ethers.TypedDataEncoder.hash(
    safeTxDomain(chainId, safeAddress),
    SAFE_TX_TYPES,
    tx,
  );

/**
 * The eth_signTypedData_v4 payload for `tx`. Built by hand rather than with
 * TypedDataEncoder.getPayload so the chainId goes out as a number: wallets
 * compare it with their active chain, and not all of them read hex there.
 */
export const safeTxTypedDataPayload = (
  chainId: ChainId,
  safeAddress: string,
  tx: ISafeTx,
) => ({
  types: { EIP712Domain: EIP712_DOMAIN_TYPE, SafeTx: SAFE_TX_TYPES.SafeTx },
  primaryType: "SafeTx",
  domain: safeTxDomain(chainId, safeAddress),
  message: { ...tx, nonce: String(tx.nonce) },
});

/** Some wallets return v as 0/1; the Safe and its service want 27/28. */
export const normalizeSignatureV = (signature: string): string => {
  const hex = signature.toLowerCase();
  if (!/^0x[0-9a-f]{130}$/.test(hex)) return signature;
  let v = parseInt(hex.slice(-2), 16);
  if (v === 0 || v === 1) v += 27;
  return hex.slice(0, -2) + v.toString(16).padStart(2, "0");
};

const bumpSignatureV = (signature: string, by: number): string => {
  const v = parseInt(signature.slice(-2), 16) + by;
  return signature.slice(0, -2) + v.toString(16).padStart(2, "0");
};

export const isUserRejectedRequest = (error: any): boolean => {
  const message = String(error?.innerError?.message || error?.message || "");
  return (
    error?.code === 4001 ||
    error?.innerError?.code === 4001 ||
    /user (denied|rejected|cancel)/i.test(message)
  );
};

/** The wallet cannot sign typed data at all, as opposed to declining to. */
const isUnsupportedMethod = (error: any): boolean => {
  const code = error?.code ?? error?.innerError?.code;
  if (code === 4200 || code === -32601 || code === -32602) return true;
  const message = String(error?.innerError?.message || error?.message || "");
  return /not supported|unsupported|does not support|method not found|not implemented/i.test(
    message,
  );
};

/**
 * Have the connected owner sign `tx` for the Safe at `safeAddress`, returning
 * the 65-byte signature the Safe accepts. EIP-712 first, since that is what
 * every current wallet does and what the owner can read on the prompt; a
 * wallet that cannot sign typed data falls back to the Safe's eth_sign
 * flavour (a personal_sign over the hash, v raised by 4 so the Safe checks
 * it with the message prefix).
 *
 * Every signature is verified locally before it is returned: a wallet that
 * signs with an account other than `signer` would otherwise only fail at the
 * service, with a message about a stranger's address.
 */
export const signSafeTx = async (
  provider: IEip1193Provider,
  signer: string,
  chainId: ChainId,
  safeAddress: string,
  tx: ISafeTx,
): Promise<string> => {
  const from = ethers.getAddress(signer);
  const domain = safeTxDomain(chainId, safeAddress);
  const hash = safeTxHash(chainId, safeAddress, tx);

  try {
    const raw = await provider.request({
      method: "eth_signTypedData_v4",
      params: [from, JSON.stringify(safeTxTypedDataPayload(chainId, safeAddress, tx))],
    });
    const signature = normalizeSignatureV(String(raw));
    const signedBy = ethers.verifyTypedData(domain, SAFE_TX_TYPES, tx, signature);
    if (signedBy.toLowerCase() !== from.toLowerCase()) {
      throw new Error(
        `The wallet signed as ${signedBy}, not as the connected account ${from}.`,
      );
    }
    return signature;
  } catch (error: any) {
    if (isUserRejectedRequest(error) || !isUnsupportedMethod(error)) throw error;
  }

  const raw = await provider.request({
    method: "personal_sign",
    params: [hash, from],
  });
  const signature = normalizeSignatureV(String(raw));
  const signedBy = ethers.verifyMessage(ethers.getBytes(hash), signature);
  if (signedBy.toLowerCase() !== from.toLowerCase()) {
    throw new Error(
      `The wallet signed as ${signedBy}, not as the connected account ${from}.`,
    );
  }
  return bumpSignatureV(signature, 4);
};

/**
 * The service's validation errors arrive as {field: [messages]} — read them
 * out, since "422" alone says nothing about a wrong nonce or a non-owner.
 */
const describeServiceError = (status: number, body: any): string => {
  if (body && typeof body === "object") {
    const messages = Object.entries(body).flatMap(([field, value]) =>
      (Array.isArray(value) ? value : [value]).map((message) =>
        field === "nonFieldErrors" || field === "detail" || field === "message"
          ? String(message)
          : `${field}: ${message}`,
      ),
    );
    if (messages.length) return messages.join(" ");
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return `The Safe transaction service answered ${status}.`;
};

const request = async (url: string, init?: RequestInit): Promise<any> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const error: any = new Error(describeServiceError(response.status, body));
    error.status = response.status;
    throw error;
  }
  return body;
};

export const fetchSafeInfo = async (
  chainId: ChainId,
  safeAddress: string,
): Promise<ISafeInfo> => {
  const safe = ethers.getAddress(safeAddress);
  const info = await request(`${serviceUrl(chainId)}/api/v1/safes/${safe}/`);
  return {
    address: safe,
    nonce: Number(info?.nonce ?? 0),
    threshold: Number(info?.threshold ?? 0),
    owners: (info?.owners ?? []).map((owner: string) => ethers.getAddress(owner)),
    version: String(info?.version ?? ""),
  };
};

/**
 * The nonce a new proposal should take: after whatever is already queued,
 * and never below the Safe's own nonce. Proposals that were superseded stay
 * in the service unexecuted with old nonces, which the lower bound skips.
 * Pass the on-chain nonce when it is at hand; the service's copy of it lags
 * an execution by a few seconds.
 */
export const fetchNextSafeNonce = async (
  chainId: ChainId,
  safeAddress: string,
  onChainNonce?: number,
): Promise<number> => {
  const safe = ethers.getAddress(safeAddress);
  const base = serviceUrl(chainId);
  const queue = await request(
    `${base}/api/v1/safes/${safe}/multisig-transactions/?executed=false&ordering=-nonce&limit=1`,
  );
  const lastQueued = queue?.results?.[0];
  const afterQueue = lastQueued ? Number(lastQueued.nonce) + 1 : 0;
  const current =
    onChainNonce ?? (await fetchSafeInfo(chainId, safeAddress)).nonce;
  return Math.max(current, afterQueue);
};

/**
 * File `tx` with the service under the owner's signature. Resolves to the
 * Safe transaction hash, which is what Safe{Wallet} and fetchSafeTxStatus
 * know the proposal by.
 */
export const proposeSafeTx = async (
  chainId: ChainId,
  safeAddress: string,
  tx: ISafeTx,
  sender: string,
  signature: string,
  origin?: string,
): Promise<string> => {
  const safe = ethers.getAddress(safeAddress);
  const hash = safeTxHash(chainId, safeAddress, tx);
  await request(`${serviceUrl(chainId)}/api/v1/safes/${safe}/multisig-transactions/`, {
    method: "POST",
    body: JSON.stringify({
      safe,
      to: tx.to,
      value: tx.value,
      data: tx.data === "0x" ? null : tx.data,
      operation: tx.operation,
      gasToken: tx.gasToken,
      safeTxGas: Number(tx.safeTxGas),
      baseGas: Number(tx.baseGas),
      gasPrice: tx.gasPrice,
      refundReceiver: tx.refundReceiver,
      nonce: tx.nonce,
      contractTransactionHash: hash,
      sender: ethers.getAddress(sender),
      signature,
      origin: origin ?? null,
    }),
  });
  return hash;
};

/** Where a proposal stands: signatures so far, and the on-chain hash once run. */
export const fetchSafeTxStatus = async (
  chainId: ChainId,
  safeTxHashValue: string,
): Promise<ISafeTxStatus> => {
  const tx = await request(
    `${serviceUrl(chainId)}/api/v1/multisig-transactions/${safeTxHashValue}/`,
  );
  return {
    safeTxHash: tx.safeTxHash,
    nonce: Number(tx.nonce),
    confirmations: (tx.confirmations ?? []).length,
    confirmationsRequired: Number(tx.confirmationsRequired ?? 0),
    isExecuted: !!tx.isExecuted,
    isSuccessful: tx.isSuccessful ?? null,
    transactionHash: tx.transactionHash ?? null,
  };
};
