import { it, expect, describe } from "vitest"
import { formatPercent } from "../formatters";

describe("formatPercent", () => {

  // Test with positive numbers
  it("should format positive numbers correctly without sign", () => {
    expect(formatPercent(0.1234)).toBe("12.34%");
  });

  it("should format positive numbers correctly with sign", () => {
    expect(formatPercent(0.1234, true)).toBe("+12.34%");
  });

  it("should remove trailing zeros", () => {
    expect(formatPercent(0.123400)).toBe("12.34%");
    expect(formatPercent(-0.123400)).toBe("-12.34%");
  });

  // Test with negative numbers
  it("should format negative numbers correctly without sign", () => {
    expect(formatPercent(-0.1234)).toBe("-12.34%");
  });

  it("should format negative numbers correctly with sign", () => {
    expect(formatPercent(-0.1234, true)).toBe("-12.34%");
  });

  // Test rounding to two decimal places
  it("should round numbers correctly to two decimal places", () => {
    expect(formatPercent(0.56789)).toBe("56.79%");
    expect(formatPercent(-0.56789)).toBe("-56.79%");
  });

  // Test with big integers
  it("should handle big integers correctly", () => {
    expect(formatPercent(BigInt(1234), true)).toBe("+123400%");
  });

  // Test default value handling
  it("should return default value if input is undefined", () => {
    expect(formatPercent(undefined, false, "N/A")).toBe("N/A");
    expect(formatPercent(undefined, false, "N/A")).toBe("N/A");
  });

  // Test with zero
  it("should format zero correctly with sign", () => {
    expect(formatPercent(0)).toBe("0%"); // Zero shouldn't have a sign
    expect(formatPercent(0)).toBe("0%"); // Zero shouldn't have a sign
    expect(formatPercent(0, false)).toBe("0%"); // Zero shouldn't have a sign
    expect(formatPercent(0, true)).toBe("0%"); // Zero shouldn't have a sign
  });
});
