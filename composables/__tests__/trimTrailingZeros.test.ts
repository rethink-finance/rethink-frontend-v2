import { it, expect, describe } from "vitest"
import { trimTrailingZeros } from "../formatters";

describe("trimTrailingZeros", () => {

  it("should remove trailing zeros from a number with a decimal part", () => {
    expect(trimTrailingZeros("123.4500")).toBe("123.45");
  });

  it("should remove trailing zeros from a whole number", () => {
    expect(trimTrailingZeros("100.0000")).toBe("100");
  });

  it("should remove trailing zeros and the decimal point if the number is an integer", () => {
    expect(trimTrailingZeros("123.000")).toBe("123");
  });

  it("should keep the decimal point and non-zero digits", () => {
    expect(trimTrailingZeros("123.450")).toBe("123.45");
  });

  it("should not remove zeros if they are not trailing", () => {
    expect(trimTrailingZeros("123.04500")).toBe("123.045");
  });

  it("should handle numbers without any decimal part", () => {
    expect(trimTrailingZeros("123")).toBe("123");
  });

  it("should handle numbers with no trailing zeros", () => {
    expect(trimTrailingZeros("123.45")).toBe("123.45");
  });

  it("should handle the edge case of \"0\"", () => {
    expect(trimTrailingZeros("0")).toBe("0");
  });

  it("should handle the edge case of \"0.000\"", () => {
    expect(trimTrailingZeros("0.000")).toBe("0");
  });

  it("should handle the edge case of \"0.123000\"", () => {
    expect(trimTrailingZeros("0.123000")).toBe("0.123");
  });
  it("test wrong input, random word, should return original input", () => {
    expect(trimTrailingZeros("testword")).toBe("testword");
  });
});
