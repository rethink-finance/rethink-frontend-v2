import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { SYC } from "~/composables/execution/sycConsole";
import {
  DIST_IF,
  assembleMint,
  buildDistributeCall,
  distributionBlockers,
  distributorAddress,
  type SycDistributorState,
} from "~/composables/execution/sycDistribution";

const e = (n: number) => ethers.parseEther(String(n));
const DISTRIBUTOR = "0x00000000000000000000000000000000000D1570";
const A = "0x1271836313a2B692858F96D88118176E72d9eD74";
const B = "0xC419021546FDfEa5e097Bd48951cF1c8ACF9769B";
const topic = (a: string) => ethers.zeroPadValue(a, 32);
const TRANSFER = DIST_IF.token.getEvent("Transfer")!.topicHash;
const minted = (to: string, amount: bigint, tx: string, address: string = SYC.ADDR.fund) => ({
  address,
  topics: [TRANSFER, topic(ethers.ZeroAddress), topic(to)],
  data: ethers.toBeHex(amount, 32),
  transactionHash: tx,
});
const marker = (tx: string) => ({ address: DISTRIBUTOR, topics: ["0x" + "11".repeat(32)], data: "0x", transactionHash: tx });
const record = { time: 1_794_000_000n, blockNumber: 97_500_000n, total: e(34_000) };

const state = (over: Partial<SycDistributorState> = {}): SycDistributorState => ({
  seeded: true,
  reportPending: false,
  stale: false,
  inProgress: false,
  undistributed: e(34_000),
  supply: e(3_000_000),
  safeSni: e(3_034_000),
  mintCount: 2,
  recipients: [
    { wallet: A, weight: e(2016), share: 0.984, next: e(33_468) },
    { wallet: B, weight: e(32), share: 0.016, next: e(531) },
  ],
  ...over,
});

describe("SYC distributor: one mint from the contract's record and its block's logs", () => {
  it("lists who received what, largest first, with the transaction", () => {
    const mint = assembleMint(1, record, [minted(B, e(531), "0xaa"), marker("0xaa"), minted(A, e(33_468), "0xaa")], DISTRIBUTOR);
    expect(mint).toMatchObject({ index: 1, time: 1_794_000_000, block: 97_500_000, total: e(34_000), tx: "0xaa" });
    expect(mint.rows).toEqual([
      { wallet: A, amount: e(33_468) },
      { wallet: B, amount: e(531) },
    ]);
  });

  it("leaves out SYC minted in the same block by something else", () => {
    const deposit = minted("0x000000000000000000000000000000000000bEEF", e(500), "0xbb");
    const mint = assembleMint(1, record, [deposit, minted(A, e(100), "0xaa"), marker("0xaa")], DISTRIBUTOR);
    expect(mint.rows).toEqual([{ wallet: A, amount: e(100) }]);
  });

  it("ignores transfers that are not mints and tokens that are not SYC", () => {
    const transfer = { ...minted(B, e(7), "0xaa"), topics: [TRANSFER, topic(A), topic(B)] };
    const other = minted(B, e(9), "0xaa", "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57");
    const mint = assembleMint(1, record, [transfer, other, minted(A, e(100), "0xaa"), marker("0xaa")], DISTRIBUTOR);
    expect(mint.rows).toEqual([{ wallet: A, amount: e(100) }]);
  });

  it("adds up a wallet that is listed twice", () => {
    const mint = assembleMint(1, record, [minted(A, e(60), "0xaa"), minted(A, e(40), "0xaa"), marker("0xaa")], DISTRIBUTOR);
    expect(mint.rows).toEqual([{ wallet: A, amount: e(100) }]);
  });

  it("still shows the total and the time when the block's logs could not be read", () => {
    const mint = assembleMint(0, record, [], DISTRIBUTOR);
    expect(mint.tx).toBe("");
    expect(mint.rows).toEqual([]);
    expect(mint.total).toBe(e(34_000));
  });
});

describe("SYC distributor: why nothing would be distributed", () => {
  it("says nothing when a distribution is ready", () => {
    expect(distributionBlockers(state())).toEqual([]);
  });

  it("lets a call through when there is a report to apply or batches to finish", () => {
    expect(distributionBlockers(state({ reportPending: true, stale: true }))).toEqual([]);
    expect(distributionBlockers(state({ inProgress: true }))).toEqual([]);
  });

  it("names the one reason that applies first", () => {
    expect(distributionBlockers(state({ seeded: false }))[0]).toMatch(/first issuance/);
    expect(distributionBlockers(state({ stale: true }))[0]).toMatch(/wait for a report/);
    const idle = state({ undistributed: 0n, recipients: state().recipients.map((r) => ({ ...r, next: 0n })) });
    expect(distributionBlockers(idle)[0]).toMatch(/Nothing is waiting/);
  });
});

describe("SYC distributor: address and call", () => {
  it("is not deployed until an address is configured", () => {
    expect(distributorAddress()).toBe("");
  });

  it("builds a bare distribute()", () => {
    expect(buildDistributeCall().data).toBe(ethers.id("distribute()").slice(0, 10));
  });
});
