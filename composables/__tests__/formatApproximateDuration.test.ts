import { describe, expect, it } from "vitest";
import { formatApproximateDuration } from "../formatters";

const DAY = 86_400;
const HOUR = 3_600;
const MINUTE = 60;

describe("formatApproximateDuration", () => {
  it("keeps a single unit and marks the value as approximate", () => {
    expect(formatApproximateDuration(5 * DAY)).toBe("≈ 5 days");
    expect(formatApproximateDuration(DAY)).toBe("≈ 1 day");
    expect(formatApproximateDuration(4 * HOUR)).toBe("≈ 4 hours");
    expect(formatApproximateDuration(30 * MINUTE)).toBe("≈ 30 minutes");
    expect(formatApproximateDuration(45)).toBe("≈ 45 seconds");
  });

  it("drops the block-time noise the second unit used to show", () => {
    // The two values from the governance card: block counts converted with an
    // average block time land just past a whole number of days.
    expect(formatApproximateDuration(5 * DAY + 8 * MINUTE)).toBe("≈ 5 days");
    expect(formatApproximateDuration(DAY + 2 * MINUTE)).toBe("≈ 1 day");
  });

  it("promotes only when rounding fills the unit above", () => {
    // 23h40m rounds to 24 hours, which is worth saying as a day.
    expect(formatApproximateDuration(23 * HOUR + 40 * MINUTE)).toBe("≈ 1 day");
    expect(formatApproximateDuration(90 * MINUTE)).toBe("≈ 2 hours");
    // Short of that it stays in the unit that describes it honestly.
    expect(formatApproximateDuration(20 * HOUR)).toBe("≈ 20 hours");
    expect(formatApproximateDuration(59 * MINUTE)).toBe("≈ 59 minutes");
    expect(formatApproximateDuration(29 * MINUTE)).toBe("≈ 29 minutes");
  });

  it("reports no duration rather than an approximate zero", () => {
    expect(formatApproximateDuration(0)).toBe("0 seconds");
  });
});
