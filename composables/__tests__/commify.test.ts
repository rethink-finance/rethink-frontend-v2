import { describe, expect, it } from "vitest";
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
    expect(commify(12345.6789)).toBe("12,345.68");
    expect(commify(-12345.6789)).toBe("-12,345.68");
    expect(commify(12345.0)).toBe("12,345");
  });

  // Test with strings
  it("should format string numbers correctly", () => {
    expect(commify("1000000")).toBe("1,000,000");
    expect(commify("12345.6719")).toBe("12,345.67");
    expect(commify("12345.6789")).toBe("12,345.68");
    expect(commify("-12345.6789")).toBe("-12,345.68");
  });

  // Test with BigInt
  it("should format BigInt correctly", () => {
    expect(commify(BigInt(12345678901234567890n))).toBe("12,345,678,901,234,567,890");
  });

  // Test with numbers with trailing zeros
  it("should remove trailing zeros after rounding", () => {
    expect(commify("12345.6000")).toBe("12,345.60");
    expect(commify(12345.6000)).toBe("12,345.60");
  });

  // Test with negative numbers
  it("should format negative numbers correctly", () => {
    expect(commify("-1234567890")).toBe("-1,234,567,890");
    expect(commify("-12345.6789")).toBe("-12,345.68");
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
    expect(commify(1.23426789)).toBe("1.23");
    expect(commify(1.23446789)).toBe("1.23");
    expect(commify(1.23456789)).toBe("1.23");
    expect(commify(-1.98765432)).toBe("-1.99");
  });

  // Test decimals greater than 1
  it("should format decimals greater than 1 correctly", () => {
    expect(commify(1234.56719)).toBe("1,234.57");
    expect(commify(1234.56789)).toBe("1,234.57");
    expect(commify(123456.7)).toBe("123,456.70");
    expect(commify(123456.78)).toBe("123,456.78");
    expect(commify(123456.789)).toBe("123,456.79");
    expect(commify(123456.7890)).toBe("123,456.79");
    expect(commify(-9876.54321)).toBe("-9,876.54");
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
    expect(commify(123456789.9876543)).toBe("123,456,789.99");
    expect(commify(-9876543.123456789)).toBe("-9,876,543.12");
  });

  // Test edge cases for large decimals
  it("should handle large numbers correctly", () => {
    expect(commify("319.99")).toBe("319.99");
    expect(commify("319.994")).toBe("319.99");
    expect(commify("319.995")).toBe("319.99");
    expect(commify("319.996")).toBe("319.99");
    expect(commify("319.986")).toBe("319.99");
    expect(commify("319.9999")).toBe("320.00");
    expect(commify("319.99999")).toBe("320.00");
    expect(commify("319.999999")).toBe("320.00");
    expect(commify("319.9999996")).toBe("320.00");
    expect(commify("319.99999964")).toBe("320.00");
    expect(commify("319.999999648")).toBe("320.00");
    expect(commify("319.9999996480")).toBe("320.00");
    expect(commify("319.9999996480")).toBe("320.00");
    expect(commify("319.99999964800")).toBe("320.00");
    expect(commify("319.999999648000")).toBe("320.00");
    expect(commify("319.9999996480000")).toBe("320.00");
    expect(commify("319.99999964800000")).toBe("320.00");
    expect(commify("319.999999648000000")).toBe("320.00");
    expect(commify("319.9999996480000003")).toBe("320.00");
    expect(commify("319.99999964800000035")).toBe("320.00");
  });
});
