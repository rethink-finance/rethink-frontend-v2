import { ethers } from "ethers";
import { describe, expect, it } from "vitest";

import {
  MINT_IF,
  SYC_MINT,
  accountNewFlows,
  buildRoleCall,
  planMint,
  splitByWeight,
  transactionBuilderFile,
  type SafeFlowRow,
  type SycMintRecord,
} from "../sycMultisigMint";
import { SYC } from "../sycConsole";

const E = 10n ** 18n;
const ZERO = ethers.ZeroAddress;
const POOL = "0x9Ecb733A74B48eE31586c98986F0AA1eD5057c6A";
const BRIDGE = "0x00000000000000000000000000000000000B41D6";
const [C419, W1271, ECE1] = SYC_MINT.BASE.holders.map((h) => h.wallet);
const WEIGHTS = SYC_MINT.BASE.holders.map((h) => h.weight);
const BASE = SYC_MINT.BASE.holders.map((h) => h.base);
const after = (n: number) => SYC_MINT.BASE.block + n;

let txNo = 0;
const row = (o: Partial<SafeFlowRow>): SafeFlowRow => ({
  safe: "new",
  token: "SNI",
  dir: "in",
  block: after(1),
  logIndex: 0,
  tx: `0x${(++txNo).toString(16).padStart(64, "0")}`,
  from: ZERO,
  to: SYC.ADDR.safe,
  amount: 0n,
  ...o,
});
/** A swap in one transaction: WETH out of the Safe, SNI into it. */
const swap = (weth: bigint, sni: bigint, block: number): SafeFlowRow[] => {
  const tx = `0x${(++txNo).toString(16).padStart(64, "0")}`;
  return [
    row({ tx, block, token: "WETH", dir: "out", from: SYC.ADDR.safe, to: POOL, amount: weth, logIndex: 1 }),
    row({ tx, block, token: "SNI", dir: "in", from: POOL, to: SYC.ADDR.safe, amount: sni, logIndex: 2 }),
  ];
};
const roleMint = (to: string, amount: bigint, tx = "0xaa", block = after(5)): SycMintRecord => ({ to, amount, tx, block, viaRole: true });

describe("splitByWeight", () => {
  it("floors every share and gives the remainder to the largest weight", () => {
    const parts = splitByWeight(34_000n * E, WEIGHTS);
    expect(parts.reduce((s, x) => s + x, 0n)).toBe(34_000n * E);
    const floors = WEIGHTS.map((w) => (34_000n * E * w) / WEIGHTS.reduce((s, x) => s + x, 0n));
    expect(parts[0]).toBe(floors[0]);
    expect(parts[2]).toBe(floors[2]);
    expect(parts[1]).toBeGreaterThanOrEqual(floors[1]);
  });

  it("gives the remainder to the first of two equal weights", () => {
    expect(splitByWeight(10n, [1n, 1n, 1n])).toEqual([4n, 3n, 3n]);
  });

  it("splits nothing when there is no weight", () => {
    expect(splitByWeight(10n, [0n, 0n])).toEqual([0n, 0n]);
  });
});

describe("planMint", () => {
  it("owes the one-off mint (the script's result) before anything is minted", () => {
    const plan = planMint([], []);
    // Largest first, as weekly.mjs lists them.
    expect(plan.recipients).toEqual([W1271, C419, ECE1]);
    expect(plan.amounts).toEqual([BASE[1], BASE[0], BASE[2]]);
    expect(plan.totalDue).toBe(3_280_665_429_797_832_899_827_103n);
  });

  it("has nothing to mint once the one-off mint went through the role", () => {
    const plan = planMint([], SYC_MINT.BASE.holders.map((h) => roleMint(h.wallet, h.base)));
    expect(plan.totalDue).toBe(0n);
    expect(plan.recipients).toEqual([]);
    expect(plan.distributions).toEqual([{ tx: "0xaa", block: after(5), total: 3_280_665_429_797_832_899_827_103n }]);
  });

  it("splits a 34,000 SNI incentive mint by the fixed sniETH weights", () => {
    const mints = SYC_MINT.BASE.holders.map((h) => roleMint(h.wallet, h.base));
    const plan = planMint([row({ amount: 34_000n * E })], mints);
    const parts = splitByWeight(34_000n * E, WEIGHTS);
    expect(plan.amounts).toEqual([parts[1], parts[0], parts[2]]);
    expect(plan.totalDue).toBe(34_000n * E);
    expect(plan.flows.incentives).toHaveLength(1);
  });

  it("does not distribute an SNI mint of any other size, and flags it", () => {
    const plan = planMint([row({ amount: 5n * E, block: after(6) })], SYC_MINT.BASE.holders.map((h) => roleMint(h.wallet, h.base)));
    expect(plan.totalDue).toBe(0n);
    expect(plan.flags.join(" ")).toMatch(/not the 34,000 incentive/);
  });

  it("owes the SNI that yield WETH bought, split by weight", () => {
    const rows = [
      row({ token: "WETH", from: BRIDGE, amount: E / 2n, block: after(1) }),
      ...swap(E / 2n, 1_000n * E, after(2)),
    ];
    const flows = accountNewFlows(rows);
    expect(flows.yieldSni).toBe(1_000n * E);
    expect(flows.unswappedWeth).toBe(0n);
    expect(flows.owed).toEqual(splitByWeight(1_000n * E, WEIGHTS));
  });

  it("counts yield WETH not swapped yet as waiting, not owed", () => {
    const rows = [row({ token: "WETH", from: BRIDGE, amount: E, block: after(1) }), ...swap(E / 4n, 400n * E, after(2))];
    const flows = accountNewFlows(rows);
    expect(flows.yieldSni).toBe(400n * E);
    expect(flows.unswappedWeth).toBe((3n * E) / 4n);
  });

  it("owes nothing for SNI bought back with the proceeds of SNI the Safe sold", () => {
    const sale = `0x${"5".repeat(64)}`;
    const rows = [
      row({ tx: sale, token: "SNI", dir: "out", from: SYC.ADDR.safe, to: POOL, amount: 100n * E, block: after(1), logIndex: 1 }),
      row({ tx: sale, token: "WETH", dir: "in", from: POOL, amount: E / 20n, block: after(1), logIndex: 2 }),
      ...swap(E / 20n, 99n * E, after(2)),
    ];
    const flows = accountNewFlows(rows);
    expect(flows.yieldSni).toBe(0n);
    expect(flows.owed).toEqual([0n, 0n, 0n]);
  });

  it("splits one swap across two yield lots, oldest first", () => {
    const rows = [
      row({ token: "WETH", from: BRIDGE, amount: E, block: after(1) }),
      row({ token: "WETH", from: BRIDGE, amount: E, block: after(2) }),
      ...swap(2n * E, 3_000n * E, after(3)),
    ];
    const flows = accountNewFlows(rows);
    expect(flows.yieldSni).toBe(3_000n * E);
    expect(flows.owed).toEqual(
      splitByWeight(1_500n * E, WEIGHTS).map((x, i) => x + splitByWeight(1_500n * E, WEIGHTS)[i]),
    );
  });

  it("adds test dust to the latest yield lot", () => {
    const rows = [
      row({ token: "WETH", from: BRIDGE, amount: E, block: after(1) }),
      row({ token: "WETH", from: BRIDGE, amount: E / 1000n, block: after(2) }),
    ];
    expect(accountNewFlows(rows).unswappedWeth).toBe(E + E / 1000n);
  });

  it("ignores moves between the old and the new Safe", () => {
    const rows = [row({ token: "WETH", from: SYC_MINT.OLD_SAFE, amount: E, block: after(1) })];
    expect(accountNewFlows(rows).unswappedWeth).toBe(0n);
  });

  it("reads only what happened after the base block", () => {
    const rows = [row({ amount: 34_000n * E, block: SYC_MINT.BASE.block })];
    expect(accountNewFlows(rows).incentives).toEqual([]);
  });

  it("never counts a mint outside the role as paid, and flags it", () => {
    const plan = planMint([], [{ to: C419, amount: 10n * E, tx: "0xbb", block: after(3), viaRole: false }]);
    expect(plan.rows.find((r) => r.wallet === C419)?.minted).toBe(0n);
    expect(plan.flags.join(" ")).toMatch(/not distributions/);
  });

  it("flags SNI that left the Safe since the last distribution", () => {
    const plan = planMint(
      [row({ dir: "out", from: SYC.ADDR.safe, to: POOL, amount: E, block: SYC_MINT.IGNORE_SNI_MINTS_BEFORE + 1 })],
      [],
    );
    expect(plan.flags.join(" ")).toMatch(/1 SNI transfer\(s\) out of the Safe/);
  });

  it("mints nothing to a wallet that has had more than it is owed", () => {
    const plan = planMint([], [roleMint(ECE1, BASE[2] + E)]);
    expect(plan.rows.find((r) => r.wallet === ECE1)?.due).toBe(0n);
    expect(plan.recipients).not.toContain(ECE1);
    expect(plan.flags.join(" ")).toMatch(/more than it is owed/);
  });
});

describe("the transaction", () => {
  it("is the vault's mintToMany through the Roles modifier as SYC-Distributor", () => {
    const call = buildRoleCall([1n, 2n], [C419, W1271]);
    expect(call.to).toBe(SYC.ADDR.roles);
    const outer = MINT_IF.roles.decodeFunctionData("execTransactionWithRole", call.data);
    expect(outer.to).toBe(SYC.ADDR.fund);
    expect(ethers.decodeBytes32String(outer.roleKey)).toBe("SYC-Distributor");
    expect(outer.shouldRevert).toBe(true);
    const flow = MINT_IF.fund.decodeFunctionData("fundFlowsCall", outer.data);
    const mint = MINT_IF.flows.decodeFunctionData("mintToMany", flow.flowCall);
    expect(mint.amounts).toEqual([1n, 2n]);
    expect(mint.recipients).toEqual([C419, W1271]);
  });

  it("is written as the Transaction Builder file weekly.mjs writes", () => {
    const plan = planMint([], []);
    const file = transactionBuilderFile(plan, "2026-11-24", 1);
    expect(file.chainId).toBe("137");
    expect(file.meta.createdFromSafeAddress).toBe(SYC_MINT.ADMIN_SAFE);
    expect(file.transactions).toHaveLength(1);
    expect(file.transactions[0].to).toBe(SYC.ADDR.roles);
    expect(file.transactions[0].data).toBe(buildRoleCall(plan.amounts, plan.recipients).data);
  });

  it("has no transaction when nothing is due", () => {
    const plan = planMint([], SYC_MINT.BASE.holders.map((h) => roleMint(h.wallet, h.base)));
    expect(transactionBuilderFile(plan, "2026-11-24").transactions).toEqual([]);
  });
});

describe("against weekly.mjs", () => {
  it("builds the same transaction as the script's one-off mint file, to the byte", () => {
    // scripts/syc-distribution/out/2026-11-24/safe-transaction.json, written by weekly.mjs before the one-off mint.
    const scriptData =
      "0xc6fe8747000000000000000000000000c868eadf7dc14cd48dc7b4a262b167a8c09b80070000000000000000000000000000000000000000000000000000000000000000";
    const plan = planMint([], []);
    expect(buildRoleCall(plan.amounts, plan.recipients).data.startsWith(scriptData)).toBe(true);
  });
});
