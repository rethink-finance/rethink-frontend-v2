import { it, expect, describe } from "vitest";
import { formatNumberShort } from "../formatters";

describe("formatNumberShort", () => {
  // Test undefined or null input
  it("should return 'N/A' for undefined input", () => {
    expect(formatNumberShort(undefined)).toBe("N/A");
  });

  it("should return 'N/A' for null input", () => {
    expect(formatNumberShort(null)).toBe("N/A");
  });

  // Test small numbers
  it("should format small numbers without abbreviation", () => {
    expect(formatNumberShort(0)).toBe("0");
    expect(formatNumberShort(1)).toBe("1");
    expect(formatNumberShort(3)).toBe("3");
    expect(formatNumberShort(5)).toBe("5");
    expect(formatNumberShort(123)).toBe("123");
  });

  // Test numbers in the thousands
  it("should format thousands with 'K' abbreviation", () => {
    expect(formatNumberShort(1500)).toBe("1.5K");
    expect(formatNumberShort(53200)).toBe("53.2K");
    expect(formatNumberShort(123456)).toBe("123.46K");
  });

  // Test numbers in the millions
  it("should format millions with 'M' abbreviation", () => {
    expect(formatNumberShort(1500000)).toBe("1.5M");
    expect(formatNumberShort(5320000)).toBe("5.32M");
    expect(formatNumberShort(123456789)).toBe("123.46M");
  });

  // Test numbers in the billions
  it("should format billions with 'B' abbreviation", () => {
    expect(formatNumberShort(1500000000)).toBe("1.5B");
    expect(formatNumberShort(5320000000)).toBe("5.32B");
    expect(formatNumberShort(123456789000)).toBe("123.46B");
  });

  // Test numbers in the trillions
  it("should format trillions with 'T' abbreviation", () => {
    expect(formatNumberShort(1500000000000)).toBe("1.5T");
    expect(formatNumberShort(5320000000000)).toBe("5.32T");
    expect(formatNumberShort(123456789000000)).toBe("123.46T");
  });

  // Test negative numbers
  it("should format negative numbers correctly", () => {
    expect(formatNumberShort(-1500)).toBe("-1.5K");
    expect(formatNumberShort(-5320000)).toBe("-5.32M");
    expect(formatNumberShort(-1234567890000)).toBe("-1.23T");
  });

  // Test very large numbers
  it("should handle very large numbers gracefully", () => {
    expect(formatNumberShort(1000000000000)).toBe("1T");      // Trillion
    expect(formatNumberShort(1e12)).toBe("1T");      // Trillion
    expect(formatNumberShort(1e13)).toBe("10T");     // 10 Trillion
    expect(formatNumberShort(1e15)).toBe("1000T");   // 1 Quadrillion (approximated to T)
    expect(formatNumberShort(1e9)).toBe("1B");       // Billion
    expect(formatNumberShort(1500)).toBe("1.5K");    // Thousand
    expect(formatNumberShort(0)).toBe("0");          // Zero
    expect(formatNumberShort(1.5e15)).toBe("1500T");  // Quadrillion with decimals
  });

  // Test invalid string input
  it("should return 'N/A' for non-numeric string input", () => {
    expect(formatNumberShort("not a number")).toBe("N/A");
  });

  // Test valid string input
  it("should format numeric strings correctly", () => {
    expect(formatNumberShort("1500")).toBe("1.5K");
    expect(formatNumberShort("1500.0")).toBe("1.5K");
    expect(formatNumberShort("1500.00")).toBe("1.5K");
    expect(formatNumberShort("123456789")).toBe("123.46M");
  });

  // Test BigInt input
  it("should format BigInt values correctly", () => {
    expect(formatNumberShort(BigInt(1500))).toBe("1.5K");
    expect(formatNumberShort(BigInt(123456789000))).toBe("123.46B");
  });
});
