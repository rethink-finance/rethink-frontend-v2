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

/**
 * Which of the two requests a revoke cancelled — true for the deposit one.
 * The subgraph stores this as `flag`; decoding it here keeps the explorer rows
 * as informative, which the request-queue reconstruction depends on.
 */
const REVOKE_SELECTOR = ethers
  .id("revokeDepositWithrawal(bool)")
  .slice(0, 10);

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
  /** For revokeDepositWithrawal: true = deposit request, false = redemption. */
  flag?: boolean | null;
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
): { name: string; amount: string | null; flag: boolean | null } | undefined => {
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

  let flag: boolean | null = null;
  if (selector === REVOKE_SELECTOR) {
    try {
      flag = Boolean(abiCoder.decode(["bool"], `0x${call.slice(10)}`)[0]);
    } catch {
      flag = null;
    }
  }

  return { name, amount, flag };
};

/* ---- Calls a Safe makes -------------------------------------------------- */

const SAFE_INTERFACE = new ethers.Interface([
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)",
  "function multiSend(bytes transactions)",
]);
const EXEC_TRANSACTION_SELECTOR = SAFE_INTERFACE.getFunction("execTransaction")!.selector;
const MULTI_SEND_SELECTOR = SAFE_INTERFACE.getFunction("multiSend")!.selector;

interface InnerCall {
  to: string;
  input: string;
}

/** MultiSend's packed list: operation(1) to(20) value(32) length(32) data. */
const unpackMultiSend = (packed: string): InnerCall[] => {
  const bytes = ethers.getBytes(packed);
  const calls: InnerCall[] = [];
  let offset = 0;
  while (offset + 85 <= bytes.length) {
    const to = ethers.hexlify(bytes.slice(offset + 1, offset + 21)).toLowerCase();
    const length = Number(ethers.toBigInt(bytes.slice(offset + 53, offset + 85)));
    const data = ethers.hexlify(bytes.slice(offset + 85, offset + 85 + length)).toLowerCase();
    calls.push({ to, input: data });
    offset += 85 + length;
  }
  return calls;
};

/**
 * The calls a Safe transaction makes: its owner sends `execTransaction` to the
 * Safe, and the Safe then calls the vault — so in the Safe's own history the
 * vault never appears as a recipient. A plain call is its one target; a
 * delegatecall into MultiSend is the batch it carries. Anything else yields
 * nothing.
 *
 * Only transactions that succeeded are read, and a Safe transaction submitted
 * with safeTxGas 0 (what Safe{Wallet} and this app send) reverts as a whole
 * when its inner call fails, so a success here is the inner call's success.
 */
export const unwrapSafeTransaction = (input: string): InnerCall[] => {
  if (!input.startsWith(EXEC_TRANSACTION_SELECTOR)) return [];
  try {
    const decoded = SAFE_INTERFACE.decodeFunctionData("execTransaction", input);
    const to = String(decoded[0]).toLowerCase();
    const data = String(decoded[2]).toLowerCase();
    const operation = Number(decoded[3]);
    if (operation === 0) return [{ to, input: data }];
    if (data.startsWith(MULTI_SEND_SELECTOR)) {
      const [packed] = SAFE_INTERFACE.decodeFunctionData("multiSend", data);
      return unpackMultiSend(packed);
    }
  } catch {
    // not a well-formed Safe transaction
  }
  return [];
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
      flag: decoded.flag,
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
 * A Safe's history is read through its execTransaction calls (see
 * unwrapSafeTransaction), since the vault is only ever called internally.
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

  const wallet = account.toLowerCase();
  const flows: UserVaultFlow[] = [];
  for (const transaction of transactions) {
    if (transaction.reverted) continue;

    // A wallet that is a Safe appears as the recipient of its owners'
    // execTransaction calls; the vault call is inside.
    const calls: InnerCall[] =
      transaction.to === wallet
        ? unwrapSafeTransaction(transaction.input)
        : [{ to: transaction.to, input: transaction.input }];

    for (const call of calls) {
      if (!vaults.has(call.to)) continue;
      const decoded = decodeFlowCall(call.input);
      if (!decoded) continue;

      flows.push({
        id: `${transaction.hash}:${decoded.name}`,
        name: decoded.name,
        amount: decoded.amount,
        flag: decoded.flag,
        timestamp: transaction.timestamp,
        from: transaction.from,
        txHash: transaction.hash,
        fundAddress: call.to,
      });
    }
  }

  return flows;
};
