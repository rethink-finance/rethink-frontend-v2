import { describe, expect, it } from "vitest";
import {
  formatProposalThreshold,
  fromVoteUnits,
  governanceVoteDecimals,
  isSelfGoverned,
  toVoteUnits,
} from "../fund/governanceVoteUnits";

const VAULT = "0x0dCd5D9cF6DFF56E7Ce2cbed1d39369e1B5f2ac4";
const ZERO = "0x0000000000000000000000000000000000000000";
const VEWVESHN = "0x9562ff434F4e302BA9ACc17e7543d030191B637f";

describe("isSelfGoverned", () => {
  it("treats no token, the zero address and the vault itself as self-governed", () => {
    expect(isSelfGoverned(undefined, VAULT)).toBe(true);
    expect(isSelfGoverned(ZERO, VAULT)).toBe(true);
    expect(isSelfGoverned(VAULT.toLowerCase(), VAULT)).toBe(true);
  });

  it("treats any other token as external", () => {
    expect(isSelfGoverned(VEWVESHN, VAULT)).toBe(false);
  });
});

describe("governanceVoteDecimals", () => {
  it("reads a self-governed vault at its base token's scale", () => {
    // Smart 10 on Arbitrum: USDC vault, share token declares 18.
    expect(
      governanceVoteDecimals({
        governanceToken: VAULT,
        fundAddress: VAULT,
        baseTokenDecimals: 6,
        governanceTokenDecimals: 18,
      }),
    ).toBe(6);
  });

  it("reads an external governance token at its own scale", () => {
    expect(
      governanceVoteDecimals({
        governanceToken: VEWVESHN,
        fundAddress: VAULT,
        baseTokenDecimals: 6,
        governanceTokenDecimals: 18n,
      }),
    ).toBe(18);
  });

  it("falls back to 18 when the decimals are unknown", () => {
    expect(governanceVoteDecimals({ governanceToken: VEWVESHN })).toBe(18);
    expect(
      governanceVoteDecimals({ governanceToken: ZERO, baseTokenDecimals: "x" }),
    ).toBe(18);
  });
});

describe("toVoteUnits", () => {
  it("scales the typed tokens by the vote decimals", () => {
    expect(toVoteUnits("150000", 18)).toBe(150000n * 10n ** 18n);
    expect(toVoteUnits("0.5", 6)).toBe(500000n);
    expect(toVoteUnits(32, 18)).toBe(32n * 10n ** 18n);
  });

  it("reads an empty field as no threshold", () => {
    expect(toVoteUnits("", 18)).toBe(0n);
    expect(toVoteUnits(undefined, 18)).toBe(0n);
    expect(toVoteUnits("0", 18)).toBe(0n);
  });

  it("refuses anything that is not a non-negative number", () => {
    expect(() => toVoteUnits("-1", 18)).toThrow();
    expect(() => toVoteUnits("abc", 18)).toThrow();
    expect(() => toVoteUnits("1e5", 18)).toThrow();
  });
});

describe("fromVoteUnits", () => {
  it("prints whole amounts without a fraction and keeps real fractions", () => {
    expect(fromVoteUnits(150000n * 10n ** 18n, 18)).toBe("150000");
    expect(fromVoteUnits("500000", 6)).toBe("0.5");
    expect(fromVoteUnits(0n, 18)).toBe("0");
  });

  it("round-trips through toVoteUnits", () => {
    for (const [tokens, decimals] of [["150000", 18], ["0.25", 6], ["7", 8]] as const) {
      expect(fromVoteUnits(toVoteUnits(tokens, decimals), decimals)).toBe(tokens);
    }
  });

  it("shows the ShineDAO deployment for what it is", () => {
    expect(fromVoteUnits(150000n, 18)).toBe("0.00000000000015");
  });
});

describe("formatProposalThreshold", () => {
  it("prints the honest token amount with the symbol", () => {
    expect(formatProposalThreshold(150000n, 18, "vewveSHN")).toBe(
      "0.00000000000015 vewveSHN",
    );
    expect(formatProposalThreshold(100000n, 6, "SMART10")).toBe("0.1 SMART10");
    expect(formatProposalThreshold(1000n * 10n ** 18n, 18, "tSHN")).toBe(
      "1,000 tSHN",
    );
  });

  it("names the unit when the symbol is missing and prints zero plainly", () => {
    expect(formatProposalThreshold(0n, 18, "")).toBe("0 votes");
    expect(formatProposalThreshold("0", 6)).toBe("0 votes");
  });
});
