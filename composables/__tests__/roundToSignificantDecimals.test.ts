import { it, expect, describe } from "vitest";
import { roundToSignificantDecimals } from "../formatters";

describe("roundToSignificantDecimals", () => {
  it('returns "0" when value is 0 or undefined or invalid value', () => {
    expect(roundToSignificantDecimals(0)).toBe("0");
    expect(roundToSignificantDecimals(0.0)).toBe("0");
    expect(roundToSignificantDecimals("asd")).toBe("0");
    expect(roundToSignificantDecimals("0")).toBe("0");
    expect(roundToSignificantDecimals("0.0")).toBe("0");
  });

  it("no rounding to integers", () => {
    expect(roundToSignificantDecimals(12345)).toBe("12345");
    expect(roundToSignificantDecimals("12345")).toBe("12345");
    expect(roundToSignificantDecimals("12345.000")).toBe("12345");
    expect(roundToSignificantDecimals("12345.0")).toBe("12345");
    expect(roundToSignificantDecimals(12345.0)).toBe("12345");
  });

  it("rounds correctly to the default precision of 3 significant digits", () => {
    expect(roundToSignificantDecimals(12345)).toBe("12345");
    expect(roundToSignificantDecimals("12345")).toBe("12345");
  });

  it("rounds correctly to specified precision", () => {
    expect(roundToSignificantDecimals(12345, 4)).toBe("12345");
    expect(roundToSignificantDecimals("12345", 4)).toBe("12345");
    expect(roundToSignificantDecimals(0.0012345, 2)).toBe("0.0012");
    expect(roundToSignificantDecimals(0.000024034856447498, 3)).toBe(
      "0.000024",
    );
    expect(roundToSignificantDecimals("0.000024034856447498", 3)).toBe(
      "0.000024",
    );
  });

  it("handles small numbers correctly", () => {
    expect(roundToSignificantDecimals(0.00012345)).toBe("0.000123");
    expect(roundToSignificantDecimals(0.000012345, 2)).toBe("0.000012");
  });

  it("handles large numbers correctly", () => {
    expect(roundToSignificantDecimals(1234567890)).toBe("1234567890");
    expect(roundToSignificantDecimals(1234567890, 5)).toBe("1234567890");
  });
  it("handles long decimals correctly", () => {
    expect(roundToSignificantDecimals(2015.9999907265844, 3)).toBe("2016");
    expect(roundToSignificantDecimals(2015.9999, 3)).toBe("2016");
    expect(roundToSignificantDecimals(2015.999, 3)).toBe("2015.999");
  });

  it("returns '0' for non-finite, undefined or null inputs", () => {
    expect(roundToSignificantDecimals(undefined as any)).toBe("0");
    expect(roundToSignificantDecimals(null as any)).toBe("0");
    expect(roundToSignificantDecimals(NaN)).toBe("0");
    expect(roundToSignificantDecimals(Infinity)).toBe("0");
    expect(roundToSignificantDecimals(-Infinity)).toBe("0");
  });

  it("handles negative numbers correctly", () => {
    expect(roundToSignificantDecimals(-123.456, 2)).toBe("-123.46");
    expect(roundToSignificantDecimals(-0.000123456)).toBe("-0.000123");
  });

  it("rounds exact half values away from zero", () => {
    expect(roundToSignificantDecimals(2.5, 1)).toBe("2.5");
    expect(roundToSignificantDecimals(-2.5, 1)).toBe("-2.5");
  });
  it("rounds exact half values away from zero", () => {
    expect(roundToSignificantDecimals(2.55, 1)).toBe("2.5");
    expect(roundToSignificantDecimals(-2.55, 1)).toBe("-2.5");
  });
  it("rounds exact half values away from zero", () => {
    expect(roundToSignificantDecimals(2.58, 1)).toBe("2.6");
    expect(roundToSignificantDecimals(-2.58, 1)).toBe("-2.6");
  });

  it("rolls over correctly at boundary", () => {
    expect(roundToSignificantDecimals(99.9, 1)).toBe("99.9");
    expect(roundToSignificantDecimals(99.98, 1)).toBe("100");
    expect(roundToSignificantDecimals(99.99, 1)).toBe("100");
    expect(roundToSignificantDecimals(0.9999, 2)).toBe("1");
  });

  it("preserves very small scientific numbers", () => {
    // 1e-7 default precision → "1e-7"
    expect(roundToSignificantDecimals(1e-7)).toBe("0.0000001");
    // 5.4321e-10 precision=2 → "5.4e-10"
    expect(roundToSignificantDecimals(5.4321e-10, 2)).toBe("0.00000000054");
  });

  it("handles very large numbers via scientific notation (no change)", () => {
    // 1e21 default → "1e+21"
    expect(roundToSignificantDecimals(1e21)).toBe("1e+21");
    // 9.8765e25 precision=3 → "9.88e+25"
    expect(roundToSignificantDecimals(9.8765e25, 3)).toBe("9.8765e+25");
  });
});
