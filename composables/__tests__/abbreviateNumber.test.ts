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
    expect(abbreviateNumber(1000)).toBe("1000");
  });

  it("preserves original string formatting for small numeric strings", () => {
    expect(abbreviateNumber("999.50")).toBe("999.50");
    expect(abbreviateNumber("1000.0")).toBe("1000.0");
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
});
