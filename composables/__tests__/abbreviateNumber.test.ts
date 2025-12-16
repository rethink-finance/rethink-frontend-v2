import { describe, it, expect } from "vitest";
import { abbreviateNumber } from "../abbreviateNumber";

describe("abbreviateNumber", () => {
  // Small numbers: do not modify
  it("returns numbers < 1000 unchanged", () => {
    expect(abbreviateNumber(0)).toBe("0");
    expect(abbreviateNumber(5)).toBe("5");
    expect(abbreviateNumber(12.34)).toBe("12.34");
    expect(abbreviateNumber(999)).toBe("999");
  });

  describe("more creative edge cases", () => {
    it("does not roll over units when rounding reaches 1000 of the lower unit", () => {
      // 999.95K with precision=2 -> 1000K (not 1M)
      expect(abbreviateNumber(999_950, 2)).toBe("1000K");
      // Similarly for millions
      expect(abbreviateNumber(999_950_000, 2)).toBe("1000M");
    });

    it("handles exact unit boundaries consistently with and without precision", () => {
      expect(abbreviateNumber(1_000_000)).toBe("1M");
      // Precision provided but result should still be trimmed for M/B/T
      expect(abbreviateNumber(1_000_000, 4)).toBe("1M");
      // For K, keep provided fractional zeros
      expect(abbreviateNumber(1_500, 4)).toBe("1.500K");
    });

    it("supports values beyond the largest suffix by scaling within T", () => {
      // 1e15 -> 1000T
      expect(abbreviateNumber(1_000_000_000_000_000)).toBe("1000T");
    });

    it("treats negative zero number as '0' but preserves string '-0'", () => {
      // number -0 becomes "0"
      expect(abbreviateNumber(-0)).toBe("0");
      // string "-0" is preserved verbatim when no precision is provided
      expect(abbreviateNumber("-0")).toBe("-0");
    });

    it("parses and abbreviates permissive numeric strings, preserving non-numeric originals when < 1000 and no precision", () => {
      expect(abbreviateNumber("  1000  ")).toBe("1K");
      expect(abbreviateNumber("+1500")).toBe("1.5K");
      // commas break numeric parsing at the comma for parseFloat, resulting in 1 (<1000)
      // since precision is not provided and input is a string, return original formatting
      expect(abbreviateNumber("1,500")).toBe("1,500");
      // embedded units: numeric prefix 1000 is parsed -> abbreviate
      expect(abbreviateNumber("1000 apples")).toBe("1K");
      // embedded units with < 1000 and no precision -> return as-is
      expect(abbreviateNumber("999 apples")).toBe("999 apples");
      // with precision provided, numeric value is formatted using toPrecision
      expect(abbreviateNumber("999 apples", 4)).toBe("999.0");
    });

    it("preserves small numeric string formatting and handles fractional values < 1", () => {
      expect(abbreviateNumber("00123.4500")).toBe("00123.4500");
      expect(abbreviateNumber(0.0042)).toBe("0.0042");
      expect(abbreviateNumber(0.0042, 2)).toBe("0.0042");
      expect(abbreviateNumber("0.004200")).toBe("0.004200");
    });

    it("rounds with low precision for K and trims for M/B/T when precision is high", () => {
      // Low precision rounding
      expect(abbreviateNumber(1_500, 1)).toBe("2K");
      expect(abbreviateNumber(1_499, 1)).toBe("1K");
      // High precision, M should trim trailing zeros
      expect(abbreviateNumber(1_250_000, 6)).toBe("1.25M");
    });
  });

  it("returns 1000 unchanged", () => {
    expect(abbreviateNumber(1000)).toBe("1K");
  });

  it("preserves original string formatting for small numeric strings", () => {
    expect(abbreviateNumber("999.50")).toBe("999.50");
    expect(abbreviateNumber("1000.0")).toBe("1K");
  });

  it("returns non-numeric inputs as-is", () => {
    expect(abbreviateNumber("abc")).toBe("abc");
  });

  // Abbreviations for larger numbers
  it("abbreviates thousands with K", () => {
    expect(abbreviateNumber(1500)).toBe("1.5K");
    expect(abbreviateNumber(10000)).toBe("10K");
  });

  it("abbreviates millions with M and trims trailing zeros", () => {
    expect(abbreviateNumber(1025000)).toBe("1M"); // 1.0M -> trim to 1M
    expect(abbreviateNumber(1250000)).toBe("1.3M");
  });

  it("handles negative numbers appropriately", () => {
    expect(abbreviateNumber(-999)).toBe("-999");
    expect(abbreviateNumber(-1500)).toBe("-1.5K");
  });

  describe("with custom toPrecision parameter", () => {
    it("formats small numbers (< 1000) using provided precision for number inputs", () => {
      expect(abbreviateNumber(12.34, 3)).toBe("12.3");
      expect(abbreviateNumber(999, 4)).toBe("999.0");
      expect(abbreviateNumber(1000, 4)).toBe("1K");
    });

    it("formats small numeric strings (< 1000) using provided precision for string inputs", () => {
      expect(abbreviateNumber("12.34", 3)).toBe("12.3");
      expect(abbreviateNumber("999.50", 5)).toBe("999.50");
    });

    it("abbreviates thousands with K respecting precision and trims trailing zeros", () => {
      expect(abbreviateNumber(1500, 2)).toBe("1.5K");
      expect(abbreviateNumber(1500, 3)).toBe("1.50K");
      expect(abbreviateNumber(10000, 3)).toBe("10K");
    });

    it("abbreviates millions/billions/trillions respecting precision and trims zeros", () => {
      expect(abbreviateNumber(1025000, 2)).toBe("1M");
      expect(abbreviateNumber(1250000, 2)).toBe("1.3M");
      expect(abbreviateNumber(1250000, 4)).toBe("1.25M");
      expect(abbreviateNumber(1300000000, 2)).toBe("1.3B");
      expect(abbreviateNumber(1000000000000, 3)).toBe("1T");
    });

    it("handles negatives with precision and abbreviation", () => {
      expect(abbreviateNumber(-1500, 3)).toBe("-1.50K");
      expect(abbreviateNumber(-1250000, 2)).toBe("-1.3M");
    });

    it("returns non-numeric inputs as-is even when precision is provided", () => {
      expect(abbreviateNumber("abc", 3)).toBe("abc");
      expect(abbreviateNumber(undefined as any, 2)).toBe(undefined as any);
      expect(abbreviateNumber(null as any, 2)).toBe(null as any);
      expect(abbreviateNumber("", 2)).toBe("");
    });
  });
});
