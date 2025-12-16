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
