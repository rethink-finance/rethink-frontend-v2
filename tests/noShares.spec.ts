import { describe, expect, it } from "vitest";

import { hasNoSharePrice, isZeroSupply } from "~/composables/fund/noShares";

describe("isZeroSupply", () => {
  it("is true for a supply known to be zero, however it arrives", () => {
    expect(isZeroSupply(0n)).toBe(true);
    expect(isZeroSupply("0")).toBe(true);
    expect(isZeroSupply(0)).toBe(true);
  });

  it("is false for a supply that is not known", () => {
    expect(isZeroSupply(undefined)).toBe(false);
    expect(isZeroSupply(null)).toBe(false);
    expect(isZeroSupply("")).toBe(false);
    expect(isZeroSupply("not a number")).toBe(false);
  });

  it("is false once any share exists", () => {
    expect(isZeroSupply(1n)).toBe(false);
    expect(isZeroSupply("3280665429800000000000000")).toBe(false);
  });
});

describe("hasNoSharePrice", () => {
  it("drops the backend's 0 price for a vault with no shares (SNI Yield Claim Vault before its first mint)", () => {
    expect(hasNoSharePrice(0, "0")).toBe(true);
    expect(hasNoSharePrice(null, "0")).toBe(true);
    expect(hasNoSharePrice(undefined, 0n)).toBe(true);
  });

  it("keeps a vault priced against a stand-in supply, whose real supply is 0", () => {
    expect(hasNoSharePrice(1.0412, "0")).toBe(false);
  });

  it("keeps every vault that has shares", () => {
    expect(hasNoSharePrice(0, "1000")).toBe(false);
    expect(hasNoSharePrice(1.0000006, "3280665429800000000000000")).toBe(false);
  });

  it("does not guess when the supply is unknown", () => {
    expect(hasNoSharePrice(0, undefined)).toBe(false);
  });
});
