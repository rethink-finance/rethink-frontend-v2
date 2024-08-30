import { it, expect, describe } from "vitest"
import { roundToSignificantDecimals } from "../formatters";

describe("roundToSignificantDecimals", () => {
  it("returns \"0\" when value is 0 or undefined or invalid value", () => {
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
    expect(roundToSignificantDecimals(0.000024034856447498, 3)).toBe("0.000024");
    expect(roundToSignificantDecimals("0.000024034856447498", 3)).toBe("0.000024");
  });

  it("handles small numbers correctly", () => {
    expect(roundToSignificantDecimals(0.00012345)).toBe("0.000123");
    expect(roundToSignificantDecimals(0.000012345, 2)).toBe("0.000012");
  });

  it("handles large numbers correctly", () => {
    expect(roundToSignificantDecimals(1234567890)).toBe("1234567890");
    expect(roundToSignificantDecimals(1234567890, 5)).toBe("1234567890");
  });
});
