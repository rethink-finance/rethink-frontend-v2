import { it, expect, describe } from "vitest"
import { formatTokenValue } from "../formatters";

describe("formatTokenValue", () => {
  it("returns \"0\" when value or decimals are undefined", () => {
    expect(formatTokenValue(undefined, undefined)).toBe("0");
    expect(formatTokenValue(100n, undefined)).toBe("0");
    expect(formatTokenValue(undefined, 18)).toBe("0");
  });

  it("formats value correctly without rounding or commifying", () => {
    expect(formatTokenValue(1000000000000000000n, 18, false)).toBe("1.0");
  });

  it("formats value correctly with commifying", () => {
    expect(formatTokenValue(1000000000000000000n, 18, true)).toBe("1");
  });

  it("rounds value to significant digits when requested", () => {
    expect(formatTokenValue(1234500000000000000n, 18, false, true)).toBe("1.23");
  });

  it("test more than 18 decimals", () => {
    const badValue = BigInt("10000000000000000000000000000000000000000");
    expect(formatTokenValue(badValue, 18)).toBe("10,000,000,000,000,000,000,000");
    expect(formatTokenValue(badValue, 18, false)).toBe("10000000000000000000000.0");
  });
});
