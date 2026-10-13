import { describe, expect, it } from "vitest";
import { formatDisplayAmount } from "../formatters";

describe("formatDisplayAmount", () => {
  it("shows dust as below the smallest step instead of every digit", () => {
    // sciETH's NAV table: 3 wei of WETH.
    expect(formatDisplayAmount(3n, 18)).toBe("< 0.000001");
    expect(formatDisplayAmount(500_000_000_000n, 18)).toBe("< 0.000001");
    expect(formatDisplayAmount(-3n, 18)).toBe("> -0.000001");
  });

  it("keeps the app's usual style for everything else", () => {
    // Two decimals from 1 up, three significant digits below 1.
    expect(formatDisplayAmount(1_000_000_005n, 6)).toBe("1,000.00");
    expect(formatDisplayAmount(13_677n, 6)).toBe("0.0137");
    expect(formatDisplayAmount(1_000_000_000_000_000n, 18)).toBe("0.001");
    expect(formatDisplayAmount(1_234_567_891_234_567_891n, 18)).toBe("1.23");
    expect(formatDisplayAmount(5_000_020_000n, 6)).toBe("5,000.02");
  });

  it("formats zero, whole and negative amounts", () => {
    expect(formatDisplayAmount(0n, 18)).toBe("0");
    expect(formatDisplayAmount(1_000_000_000_000n, 6)).toBe("1,000,000");
    expect(formatDisplayAmount(7n, 0)).toBe("7");
    expect(formatDisplayAmount(-2_500_000n, 6)).toBe("-2.50");
  });
});
