import { describe, expect, it } from "vitest";
import {
  calculateFundToBaseExchangeRate,
  calculateSharePrice,
} from "../exchangeRate";
import { calculateCumulativeWithSharePrice } from "../utils";

/**
 * Figures taken from live vaults, so a regression here is a regression against
 * what the chain actually holds rather than against a made-up example.
 *
 * The share token reports 18 decimals on all of them and mints in the base
 * token's smallest unit regardless, which is the whole point: only the vaults
 * whose base token also has 18 decimals were ever priced correctly.
 */
const CARROT = {
  // CarrotFunding Vault, HyperEVM. USDC, 6 decimals.
  totalNav: 42_150_825_418n,
  totalSupply: 37_097_290_463n,
  baseDecimals: 6,
};
const BOREAL = {
  // Boreal USD Yield, Ethereum. USDC, 6 decimals, sitting exactly at par.
  totalNav: 100_000_000n,
  totalSupply: 100_000_000n,
  baseDecimals: 6,
};
const SOONAMI = {
  // soonami Venture Staking, Ethereum. WETH, 18 decimals — never affected.
  totalNav: 2_048_050_499_967_999_999_999n,
  totalSupply: 2_048_049_990_469_722_296_113n,
  baseDecimals: 18,
};

const SHARE_TOKEN_DECIMALS = 18;

describe("calculateSharePrice", () => {
  it("prices a USDC vault in units a reader recognises, not 1e12 of them", () => {
    const price = calculateSharePrice(CARROT.totalNav, CARROT.totalSupply);

    expect(price).toBeCloseTo(1.1362, 4);
    expect(price).toBeLessThan(2);
  });

  it("reads exactly par for a vault whose NAV still matches its supply", () => {
    expect(calculateSharePrice(BOREAL.totalNav, BOREAL.totalSupply)).toBe(1);
  });

  it("leaves an 18-decimal base token where it already was", () => {
    expect(
      calculateSharePrice(SOONAMI.totalNav, SOONAMI.totalSupply),
    ).toBeCloseTo(1.00000025, 8);
  });

  it("returns nought rather than dividing by an empty share count", () => {
    expect(calculateSharePrice(CARROT.totalNav, 0n)).toBe(0);
  });
});

describe("calculateFundToBaseExchangeRate", () => {
  /**
   * The decimal gap is load-bearing here and must survive: Redeem.vue and
   * current_cycle format a share balance with the share token's declared 18
   * decimals and multiply by this rate, so on a USDC vault it has to carry the
   * 1e12 back. Collapsing this into calculateSharePrice would put every
   * redemption preview out by twelve orders of magnitude.
   */
  it("converts a share balance formatted at 18 decimals back into base token", () => {
    const rate = calculateFundToBaseExchangeRate(
      CARROT.totalNav,
      CARROT.totalSupply,
      CARROT.baseDecimals,
      SHARE_TOKEN_DECIMALS,
    );

    const sharesAsFormatted = Number(CARROT.totalSupply) / 10 ** SHARE_TOKEN_DECIMALS;
    const baseTokens = rate * sharesAsFormatted;

    expect(baseTokens).toBeCloseTo(Number(CARROT.totalNav) / 10 ** CARROT.baseDecimals, 2);
  });

  it("is the same number as the share price when base and share decimals agree", () => {
    expect(
      calculateFundToBaseExchangeRate(
        SOONAMI.totalNav,
        SOONAMI.totalSupply,
        SOONAMI.baseDecimals,
        SHARE_TOKEN_DECIMALS,
      ),
    ).toBeCloseTo(calculateSharePrice(SOONAMI.totalNav, SOONAMI.totalSupply), 12);
  });
});

describe("calculateCumulativeWithSharePrice", () => {
  /**
   * The baseline used to be 10 ** (baseDecimals - shareDecimals), which cancelled
   * the same gap the share price carried. Both halves went together, so the
   * headline return has to land on the same figure it always showed.
   */
  it("measures a USDC vault against par", () => {
    const price = calculateSharePrice(CARROT.totalNav, CARROT.totalSupply);

    expect(
      calculateCumulativeWithSharePrice(
        undefined,
        price,
        CARROT.baseDecimals,
        SHARE_TOKEN_DECIMALS,
      ),
    ).toBeCloseTo(0.1362, 4);
  });

  it("reports nothing gained by a vault still at par", () => {
    const price = calculateSharePrice(BOREAL.totalNav, BOREAL.totalSupply);

    expect(
      calculateCumulativeWithSharePrice(
        undefined,
        price,
        BOREAL.baseDecimals,
        SHARE_TOKEN_DECIMALS,
      ),
    ).toBe(0);
  });

  it("still measures against a configured initial price where one exists", () => {
    // QCL Gains Fund: WETH base, initial price 0.537, live price 0.4595699925.
    expect(
      calculateCumulativeWithSharePrice(0.537, 0.4595699924582866, 18, 18),
    ).toBeCloseTo(-0.14419, 5);
  });
});
