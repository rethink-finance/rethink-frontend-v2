import { describe, expect, it } from "vitest";
import {
  BLOCK_SHARE,
  GAS_BUFFER,
  TX_GAS_CAPS,
  TransactionGasCapError,
  bracketRequiredGas,
  formatGas,
  planGasLimit,
} from "../gasLimit";

describe("planGasLimit", () => {
  it("adds headroom when the block has room for it", () => {
    // Smart 10 on Arbitrum: 3.67M needed, no meaningful block ceiling.
    expect(planGasLimit(3_672_333, 2 ** 50)).toEqual({
      gas: Math.ceil(3_672_333 * GAS_BUFFER),
      exceedsBlockLimit: false,
    });
  });

  it("works without a known block limit", () => {
    expect(planGasLimit(600_000)).toEqual({
      gas: 900_000,
      exceedsBlockLimit: false,
    });
  });

  it("leaves room for the swing seen between two Arbitrum NAV updates", () => {
    // QCL: estimated around 5.96M gas used, and 6.32M four minutes later.
    const plan = planGasLimit(6_500_000, 2 ** 50);
    expect(plan.gas).toBeGreaterThan(6_500_000 * 1.4);
    expect(plan.exceedsBlockLimit).toBe(false);
  });

  it("takes what the block allows when only the headroom does not fit", () => {
    // The HyperEVM NAV update that failed with a wallet-chosen 437,310: it
    // needs 2,383,131 and a small block holds 3,000,000.
    const plan = planGasLimit(2_383_131, 3_000_000);
    expect(plan).toEqual({ gas: 2_850_000, exceedsBlockLimit: false });
    expect(plan.gas).toBeGreaterThan(2_383_131);
  });

  it("flags a call that cannot fit a standard block, and still sizes it", () => {
    // HyperEVM vault creation: ~4.65M against a 3M small block. Only a sender
    // with big blocks enabled can mine it, at the buffered limit.
    expect(planGasLimit(4_648_000, 3_000_000)).toEqual({
      gas: Math.ceil(4_648_000 * GAS_BUFFER),
      exceedsBlockLimit: true,
    });
  });

  it("never exceeds a per-transaction cap the call itself fits under", () => {
    const cap = TX_GAS_CAPS["0x1"];
    // 15M needed on Ethereum: buffered would be 22.5M, above the 2^24 cap.
    expect(planGasLimit(15_000_000, 60_000_000, cap)).toEqual({
      gas: cap,
      exceedsBlockLimit: false,
    });
  });

  it("uses the tighter of the block share and the transaction cap", () => {
    expect(planGasLimit(1_000_000, 1_200_000, 5_000_000).gas).toBe(
      Math.floor(1_200_000 * BLOCK_SHARE),
    );
  });
});

describe("the per-transaction gas cap", () => {
  const BASE_CAP = TX_GAS_CAPS["0x2105"];

  it("knows Base enforces 2^24, like Ethereum", () => {
    expect(BASE_CAP).toBe(2 ** 24);
    expect(TX_GAS_CAPS["0x1"]).toBe(2 ** 24);
  });

  it("holds a Base limit under the cap when the call itself fits", () => {
    // 12M needed: buffered would be 18M, which Base would refuse outright.
    expect(planGasLimit(12_000_000, 400_000_000, BASE_CAP)).toEqual({
      gas: BASE_CAP,
      exceedsBlockLimit: false,
    });
  });

  it("brackets what a call needs from dry runs alone", async () => {
    // INDEFI's NAV update: fails at the cap, mined at 17.8M used in April.
    const needs = 18_400_000;
    const probed: number[] = [];
    const required = await bracketRequiredGas(BASE_CAP, (gas) => {
      probed.push(gas);
      return Promise.resolve(gas >= needs);
    });
    expect(required).toBeGreaterThanOrEqual(needs);
    expect(required).toBeLessThan(needs * 1.1);
    expect(probed.length).toBe(6);
  });

  it("gives up on a figure when even four times the cap fails", async () => {
    expect(
      await bracketRequiredGas(BASE_CAP, () => Promise.resolve(false)),
    ).toBeUndefined();
  });

  it("says what is wrong in one sentence, with or without a figure", () => {
    const measured = new TransactionGasCapError(BASE_CAP, 18_400_000, "Base");
    expect(measured.message).toContain("about 18.4M gas");
    expect(measured.message).toContain("Base allows at most 16.8M");
    expect(measured.message).toContain("from any wallet");
    expect(measured).toBeInstanceOf(Error);

    const unmeasured = new TransactionGasCapError(BASE_CAP, undefined, "Base");
    expect(unmeasured.message).toContain("more than 16.8M gas");
  });

  it("formats gas for reading", () => {
    expect(formatGas(17_838_341)).toBe("17.8M");
    expect(formatGas(437_310)).toBe("437,310");
  });
});
