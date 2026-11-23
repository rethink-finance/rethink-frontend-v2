/**
 * SNI Yield Claim Vault: SYC minted to sniETH depositors by the SycDistributor
 * contract (scripts/syc-distributor).
 *
 * Nobody proposes or signs these mints. Anyone, normally a keeper, calls
 * distribute(), and the contract mints the SNI that sits in the Safe without
 * SYC issued against it, split by each depositor's sniETH. It can never mint
 * more SYC than there is SNI in the Safe.
 *
 * A report of new sniETH balances from Ethereum is applied by the next call
 * too, and a distribution to many wallets goes out in batches, one per call.
 *
 * This module reads the contract for the console: what is waiting, who gets
 * what next, and every mint it has made. The mint log lives in the contract
 * (mints()), so the history is two cheap reads per entry rather than a scan.
 */
import { ethers } from "ethers";
import { ethCallOn, rpcRequestOn } from "./rpc";
import { IF, SYC, sycToken, type SycCall } from "./sycConsole";

export const SYC_DIST = {
  /** The SycDistributor on Polygon. Empty until it is deployed. */
  DISTRIBUTOR: "",
  /** Mints shown in the console, newest first. */
  HISTORY: 20,
} as const;

export const DIST_IF = {
  distributor: new ethers.Interface([
    "function seeded() view returns (bool)",
    "function pendingReport() view returns (bytes32)",
    "function weightsFresh() view returns (bool)",
    "function roundAmount() view returns (uint256)",
    "function undistributed() view returns (uint256)",
    "function totalWeight() view returns (uint256)",
    "function recipients() view returns (address[])",
    "function weights() view returns (uint256[])",
    "function preview() view returns (address[], uint256[])",
    "function mintCount() view returns (uint256)",
    "function mints(uint256 from, uint256 count) view returns ((uint64 time, uint64 blockNumber, uint128 total)[])",
    "function distribute() returns (uint256)",
  ]),
  token: new ethers.Interface([
    "function totalSupply() view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]),
};
const TRANSFER_TOPIC = DIST_IF.token.getEvent("Transfer")!.topicHash;
const ZERO_TOPIC = ethers.zeroPadValue(ethers.ZeroAddress, 32);

export const distributorAddress = (): string =>
  ethers.isAddress(SYC_DIST.DISTRIBUTOR) ? ethers.getAddress(SYC_DIST.DISTRIBUTOR) : "";

export interface SycRecipient {
  wallet: string;
  /** sniETH this wallet's share is based on. */
  weight: bigint;
  /** Fraction of every distribution, 0..1. */
  share: number;
  /** What the next distribution would mint to it. */
  next: bigint;
}

export interface SycDistributorState {
  /** The first issuance has been minted. */
  seeded: boolean;
  /** A report from Ethereum is waiting to be applied; distributions wait for it. */
  reportPending: boolean;
  /** No report has confirmed the sniETH balances for longer than the contract allows; distributions wait for one. */
  stale: boolean;
  /** A distribution to many wallets is part-way through its batches. */
  inProgress: boolean;
  /** SNI in the Safe with no SYC issued against it. */
  undistributed: bigint;
  supply: bigint;
  safeSni: bigint;
  mintCount: number;
  recipients: SycRecipient[];
}

const read = async (fn: string, args: unknown[] = []) =>
  DIST_IF.distributor.decodeFunctionResult(
    fn,
    await ethCallOn(SYC.CHAIN, distributorAddress(), DIST_IF.distributor.encodeFunctionData(fn, args)),
  );

export const readDistributorState = async (): Promise<SycDistributorState> => {
  const [seeded, pending, fresh, round, undistributed, totalWeight, wallets, weights, preview, count, supplyHex, sniHex] =
    await Promise.all([
      read("seeded"),
      read("pendingReport"),
      read("weightsFresh"),
      read("roundAmount"),
      read("undistributed"),
      read("totalWeight"),
      read("recipients"),
      read("weights"),
      read("preview"),
      read("mintCount"),
      ethCallOn(SYC.CHAIN, SYC.ADDR.fund, DIST_IF.token.encodeFunctionData("totalSupply")),
      ethCallOn(SYC.CHAIN, sycToken("SNI").address, IF.erc20.encodeFunctionData("balanceOf", [SYC.ADDR.safe])),
    ]);
  const total = totalWeight[0] as bigint;
  const recipients: SycRecipient[] = [...(wallets[0] as string[])].map((wallet, i) => {
    const weight = (weights[0] as bigint[])[i];
    return {
      wallet: ethers.getAddress(wallet),
      weight,
      share: total > 0n ? Number((weight * 1_000_000_000n) / total) / 1e9 : 0,
      next: (preview[1] as bigint[])[i] ?? 0n,
    };
  });
  return {
    seeded: Boolean(seeded[0]),
    reportPending: pending[0] !== ethers.ZeroHash,
    stale: !fresh[0],
    inProgress: (round[0] as bigint) > 0n,
    undistributed: undistributed[0] as bigint,
    supply: BigInt(supplyHex),
    safeSni: BigInt(sniHex),
    mintCount: Number(count[0]),
    recipients,
  };
};

export interface SycMintRow {
  wallet: string;
  amount: bigint;
}

export interface SycMint {
  /** Position in the contract's log; 0 is the first issuance. */
  index: number;
  /** Seconds. */
  time: number;
  block: number;
  total: bigint;
  /** Empty when the block's logs could not be read. */
  tx: string;
  rows: SycMintRow[];
}

/**
 * One mint, from the contract's record and the logs of its block: the SYC
 * Transfer events from the zero address in the transaction where the
 * distributor itself emitted something. Another SYC mint that happens to land
 * in the same block (a deposit) is in a different transaction and left out.
 */
export const assembleMint = (
  index: number,
  record: { time: bigint; blockNumber: bigint; total: bigint },
  logs: { address: string; topics: string[]; data: string; transactionHash: string }[],
  distributor: string,
): SycMint => {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const tx = logs.find((log) => same(log.address, distributor))?.transactionHash ?? "";
  const merged = new Map<string, bigint>();
  for (const log of logs) {
    if (!tx || !same(log.transactionHash, tx) || !same(log.address, SYC.ADDR.fund)) continue;
    if (log.topics.length < 3 || log.topics[0] !== TRANSFER_TOPIC || log.topics[1] !== ZERO_TOPIC) continue;
    const wallet = ethers.getAddress("0x" + log.topics[2].slice(26));
    merged.set(wallet, (merged.get(wallet) ?? 0n) + BigInt(log.data));
  }
  const rows = [...merged].map(([wallet, amount]) => ({ wallet, amount }));
  rows.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  return { index, time: Number(record.time), block: Number(record.blockNumber), total: record.total, tx, rows };
};

/** The latest mints, newest first. */
export const readMints = async (mintCount: number, limit: number = SYC_DIST.HISTORY): Promise<SycMint[]> => {
  if (!mintCount) return [];
  const from = Math.max(0, mintCount - limit);
  const [page] = await read("mints", [from, mintCount - from]);
  const distributor = distributorAddress();
  const mints = await Promise.all(
    [...(page as any[])].map(async (record, i) => {
      const block = ethers.toQuantity(record.blockNumber);
      // Both contracts' logs of that one block: a single-block query is never refused for its range.
      const logs = await rpcRequestOn(SYC.CHAIN, "eth_getLogs", [
        { address: [SYC.ADDR.fund, distributor], fromBlock: block, toBlock: block },
      ]).catch(() => []);
      return assembleMint(from + i, record, Array.isArray(logs) ? logs : [], distributor);
    }),
  );
  return mints.reverse();
};

/** Why nothing would be distributed right now, in the order a reader would check. Empty when it would. */
export const distributionBlockers = (state: SycDistributorState): string[] => {
  if (!state.seeded) return ["The first issuance has not been minted yet."];
  // Part-way through its batches: the next call simply continues.
  if (state.inProgress) return [];
  if (state.reportPending) return [];
  if (state.stale) return ["The sniETH balances have not been confirmed from Ethereum recently; distributions wait for a report."];
  if (state.recipients.every((r) => r.next === 0n)) return ["Nothing is waiting: every SNI in the Safe has SYC against it."];
  return [];
};

/** The manual nudge. Anyone may send it; the contract decides the amounts. */
export const buildDistributeCall = (): SycCall => ({
  to: distributorAddress(),
  data: DIST_IF.distributor.encodeFunctionData("distribute"),
});
