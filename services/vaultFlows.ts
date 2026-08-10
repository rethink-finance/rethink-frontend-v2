import { ethers } from "ethers";
import type { ChainId } from "~/types/enums/chain_id";
import {
  collectExplorerTransactions,
  createExplorerTransactionReader,
} from "~/services/explorerTransactions";

/**
 * A vault's deposits and redemptions, read from the chain's block explorer.
 *
 * The subgraph is the natural home for this and is still used where it works,
 * but it does not work everywhere: there is no Polygon or HyperEVM deployment
 * at all, and the Arbitrum one indexed nothing and stopped following the chain
 * long ago. Vaults there showed a transaction history of settlements only, with
 * every deposit and redemption missing.
 *
 * Nothing about those transactions is hard to find, though. Every depositor
 * operation is sent straight to the vault, so the vault's own transaction list
 * plus a little decoding gives the same rows the subgraph would have. That
 * holds on every chain, which is why this runs everywhere rather than only
 * where the subgraph is missing — the two are merged, and whichever saw a
 * transaction wins.
 *
 * Verified against the two chains where the subgraph does work: Ethereum and
 * Base return exactly the same flows either way.
 *
 * The one thing this cannot see is a deposit made by another contract on
 * someone's behalf, since that arrives as an internal call and never appears in
 * the vault's transaction list. The subgraph does see those, which is the other
 * half of why both are kept.
 */

/** `fundFlowsCall(bytes)` on the vault — the envelope every flow arrives in. */
const FUND_FLOWS_CALL_SELECTOR = ethers.id("fundFlowsCall(bytes)").slice(0, 10);

/**
 * The operations that envelope can carry, written exactly as the subgraph names
 * them so rows from either source label identically.
 *
 * `depositAndDelegateBySig` appears twice because the two sources disagree
 * about its signature: the app encodes the second form, the subgraph reports
 * the first. Both are listed, and both resolve to the name the app's operation
 * table is keyed by.
 */
const FLOW_SIGNATURES: Record<string, string> = {
  "deposit()": "deposit()",
  "requestDeposit(uint256)": "requestDeposit(uint256)",
  "depositAndDelegateBySig(uint256,address,bytes,uint256,uint8,bytes32,bytes32)":
    "depositAndDelegateBySig(uint256,address,bytes,uint256,uint8,bytes32,bytes32)",
  "depositAndDelegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)":
    "depositAndDelegateBySig(uint256,address,bytes,uint256,uint8,bytes32,bytes32)",
  "withdraw()": "withdraw()",
  "requestWithdraw(uint256)": "requestWithdraw(uint256)",
  "revokeDepositWithrawal(bool)": "revokeDepositWithrawal(bool)",
  "sweepTokens()": "sweepTokens()",
};

/** Selector of the inner call -> the name to report it under. */
const FLOW_NAME_BY_SELECTOR: Record<string, string> = Object.fromEntries(
  Object.entries(FLOW_SIGNATURES).map(([signature, name]) => [
    ethers.id(signature).slice(0, 10),
    name,
  ]),
);

/** Selectors whose first argument is the amount, in the caller's token. */
const AMOUNT_BEARING_SELECTORS = new Set(
  Object.keys(FLOW_SIGNATURES)
    .filter((signature) => signature.includes("(uint256"))
    .map((signature) => ethers.id(signature).slice(0, 10)),
);

/** A vault's whole depositor history is short; this is headroom, not a budget. */
const MAX_PAGES = 8;

/** One depositor operation, in the shape the activity card reads. */
export interface VaultFlow {
  /** Stable across sources so the merge can deduplicate. */
  id: string;
  /** Full signature, e.g. "requestDeposit(uint256)". */
  name: string;
  /** Raw token amount, or null for operations that carry none. */
  amount: string | null;
  /** Unix seconds. */
  timestamp: number;
  /** Who signed it. */
  from?: string;
  txHash: string;
}

/** A flow read from a wallet's own history, which has to name the vault it hit. */
export interface UserVaultFlow extends VaultFlow {
  /** The vault the call was addressed to, lowercased. */
  fundAddress: string;
}

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

/**
 * The operation a call to the vault carries.
 *
 * Most vaults are called through the `fundFlowsCall` envelope, but not all:
 * some take `requestDeposit` and `deposit` at the top level, so both shapes are
 * unwrapped here. Anything else the vault was called with — `delegate`,
 * `executeNAVUpdate`, whatever a future version adds — returns undefined.
 */
const decodeFlowCall = (
  input: string,
): { name: string; amount: string | null } | undefined => {
  let call = input;

  if (input.startsWith(FUND_FLOWS_CALL_SELECTOR)) {
    try {
      [call] = abiCoder.decode(["bytes"], `0x${input.slice(10)}`);
    } catch {
      return undefined;
    }
  }

  const selector = call.slice(0, 10);
  const name = FLOW_NAME_BY_SELECTOR[selector];
  if (!name) return undefined;

  let amount: string | null = null;
  if (AMOUNT_BEARING_SELECTORS.has(selector)) {
    try {
      amount = abiCoder.decode(["uint256"], `0x${call.slice(10)}`)[0].toString();
    } catch {
      // A truncated argument is not worth dropping the row for; the operation
      // still happened, and it reads as an amount-less one.
      amount = null;
    }
  }

  return { name, amount };
};

const cache = new Map<string, Promise<VaultFlow[]>>();

const load = async (
  chainId: ChainId,
  fundAddress: string,
  etherscanApiKey: string,
): Promise<VaultFlow[] | undefined> => {
  const read = createExplorerTransactionReader(chainId, etherscanApiKey);
  if (!read) return undefined;

  const transactions = await collectExplorerTransactions(read, fundAddress, {
    maxPages: MAX_PAGES,
  });

  const flows: VaultFlow[] = [];
  for (const transaction of transactions) {
    // A reverted deposit moved nothing, and the subgraph does not record one
    // either — showing it would invent history.
    if (transaction.reverted) continue;

    const decoded = decodeFlowCall(transaction.input);
    if (!decoded) continue;

    flows.push({
      id: `${transaction.hash}:${decoded.name}`,
      name: decoded.name,
      amount: decoded.amount,
      timestamp: transaction.timestamp,
      from: transaction.from,
      txHash: transaction.hash,
    });
  }

  return flows;
};

/**
 * Cached per vault for the life of the page, and dropped again when the lookup
 * could not run, so a later call is free to try once the chain is reachable.
 */
export const fetchExplorerVaultFlows = (
  chainId: ChainId,
  fundAddress: string,
  etherscanApiKey: string,
): Promise<VaultFlow[]> => {
  const key = `${chainId}:${fundAddress.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const request = load(chainId, fundAddress, etherscanApiKey)
    .catch((error) => {
      console.error("Failed to read vault flows from the explorer", error);
      return undefined;
    })
    .then((flows) => {
      if (!flows) cache.delete(key);
      return flows ?? [];
    });

  cache.set(key, request);
  return request;
};

/**
 * The same reading, taken from the other end: everything one wallet has sent to
 * a vault, rather than everything one vault has received.
 *
 * The portfolio needs it this way round. Asking per vault would mean one
 * explorer walk for every vault on the chain before knowing which of them the
 * wallet has ever touched, where a wallet's own history answers that in a
 * single walk — and it is short, since it is one person's transactions rather
 * than a whole vault's.
 *
 * Only calls addressed to a vault the app knows about are kept: the wallet's
 * history is full of transactions that have nothing to do with Rethink, and a
 * flow whose vault cannot be named cannot be shown anyway.
 */
export const fetchExplorerUserFlows = async (
  chainId: ChainId,
  account: string,
  vaultAddresses: string[],
  etherscanApiKey: string,
): Promise<UserVaultFlow[]> => {
  const vaults = new Set(vaultAddresses.map((address) => address.toLowerCase()));
  if (!vaults.size) return [];

  const read = createExplorerTransactionReader(chainId, etherscanApiKey);
  if (!read) return [];

  const transactions = await collectExplorerTransactions(read, account, {
    maxPages: MAX_PAGES,
  });

  const flows: UserVaultFlow[] = [];
  for (const transaction of transactions) {
    if (transaction.reverted) continue;
    if (!vaults.has(transaction.to)) continue;

    const decoded = decodeFlowCall(transaction.input);
    if (!decoded) continue;

    flows.push({
      id: `${transaction.hash}:${decoded.name}`,
      name: decoded.name,
      amount: decoded.amount,
      timestamp: transaction.timestamp,
      from: transaction.from,
      txHash: transaction.hash,
      fundAddress: transaction.to,
    });
  }

  return flows;
};
