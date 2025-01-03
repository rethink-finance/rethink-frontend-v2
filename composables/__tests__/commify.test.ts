import { it, expect, describe } from "vitest";
import { commify } from "../formatters";

describe("commify", () => {
  // Test with integers
  it("should format integers with commas", () => {
    expect(commify(1000)).toBe("1,000");
    expect(commify(1234567890)).toBe("1,234,567,890");
    expect(commify(-1000)).toBe("-1,000");
  });

  // Test with floats
  it("should format floats with commas and round fractions", () => {
    expect(commify(12345.6789)).toBe("12,345.679");
    expect(commify(-12345.6789)).toBe("-12,345.679");
    expect(commify(12345.0)).toBe("12,345");
  });

  // Test with strings
  it("should format string numbers correctly", () => {
    expect(commify("1000000")).toBe("1,000,000");
    expect(commify("12345.6719")).toBe("12,345.672");
    expect(commify("12345.6789")).toBe("12,345.679");
    expect(commify("-12345.6789")).toBe("-12,345.679");
  });

  // Test with BigInt
  it("should format BigInt correctly", () => {
    expect(commify(BigInt(12345678901234567890n))).toBe("12,345,678,901,234,567,890");
  });

  // Test with numbers with trailing zeros
  it("should remove trailing zeros after rounding", () => {
    expect(commify("12345.6000")).toBe("12,345.6");
    expect(commify(12345.6000)).toBe("12,345.6");
  });

  // Test with negative numbers
  it("should format negative numbers correctly", () => {
    expect(commify("-1234567890")).toBe("-1,234,567,890");
    expect(commify("-12345.6789")).toBe("-12,345.679");
  });

  // Test with invalid input
  it("should throw an error for badly formatted numbers", () => {
    expect(() => commify("abc")).toThrow("bad formatted number: \"abc\"");
    expect(() => commify("123.45.67")).toThrow("bad formatted number: \"123.45.67\"");
  });

  // Test with zero
  it("should handle zero correctly", () => {
    expect(commify(0)).toBe("0");
    expect(commify("0.0")).toBe("0");
  });

  // Test with edge cases
  it("should handle empty strings and invalid input gracefully", () => {
    expect(() => commify("")).toThrow("bad formatted number: \"\"");
    expect(() => commify(null as any)).toThrow("Cannot read properties of null (reading 'toString')");
    expect(() => commify(undefined as any)).toThrow("Cannot read properties of undefined (reading 'toString')");
  });

  // Test rounding behavior
  it("should round fractions to the specified decimal places", () => {
    expect(commify(1.23426789)).toBe("1.234");
    expect(commify(1.23446789)).toBe("1.234");
    expect(commify(1.23456789)).toBe("1.235");
    expect(commify(-1.98765432)).toBe("-1.988");
  });

  // Test decimals greater than 1
  it("should format decimals greater than 1 correctly", () => {
    expect(commify(1234.56719)).toBe("1,234.567");
    expect(commify(1234.56789)).toBe("1,234.568");
    expect(commify(123456.7)).toBe("123,456.7");
    expect(commify(123456.78)).toBe("123,456.78");
    expect(commify(123456.789)).toBe("123,456.789");
    expect(commify(123456.7890)).toBe("123,456.789");
    expect(commify(-9876.54321)).toBe("-9,876.543");
  });

  // Test decimals smaller than 1
  it("should format decimals smaller than 1 correctly", () => {
    expect(commify(0.567)).toBe("0.567");
    expect(commify(0.56)).toBe("0.56");
    expect(commify(-0.56)).toBe("-0.56");
    expect(commify(0.56789)).toBe("0.568");
    expect(commify(-0.54321)).toBe("-0.543");
    expect(commify(-0.54321)).toBe("-0.543");
    expect(commify(0.000456)).toBe("0.000456");
    expect(commify(0.00045600)).toBe("0.000456");
    expect(commify(0.45600)).toBe("0.456");
    expect(commify(-0.000789)).toBe("-0.000789");
  });

  // Test edge cases for small numbers
  it("should handle very small decimals correctly", () => {
    expect(commify(0.00000123)).toBe("0.00000123");
    expect(commify(-0.00000123)).toBe("-0.00000123");
    expect(commify("0.0000000001")).toBe("0");
  });

  // Test edge cases for large decimals
  it("should handle large decimals correctly", () => {
    expect(commify(123456789.9876543)).toBe("123,456,789.988");
    expect(commify(-9876543.123456789)).toBe("-9,876,543.123");
  });
});
