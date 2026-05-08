import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateAPR } from "../utils";

const SECONDS_PER_DAY = 86_400;
const NOW_SEC = 1_730_000_000;

const daysAgo = (days: number) => NOW_SEC - days * SECONDS_PER_DAY;

describe("calculateAPR", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SEC * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("annualizes a 1-year cumulative return to roughly the same value", () => {
    const apr = calculateAPR(0.08, daysAgo(365));
    expect(apr).toBeCloseTo(0.08, 4);
  });

  it("annualizes a half-year return to roughly the squared compound", () => {
    // 8% over ~182.5 days → (1.08)^2 - 1 ≈ 0.1664
    const apr = calculateAPR(0.08, daysAgo(365 / 2));
    expect(apr).toBeCloseTo(0.1664, 3);
  });

  it("returns a negative APR for a negative cumulative return", () => {
    const apr = calculateAPR(-0.1, daysAgo(200));
    expect(apr).toBeDefined();
    expect(apr! < 0).toBe(true);
  });

  it("returns undefined when daysSinceInception < 7", () => {
    expect(calculateAPR(0.05, daysAgo(6))).toBeUndefined();
    expect(calculateAPR(0.05, daysAgo(0.5))).toBeUndefined();
  });

  it("returns undefined when cumulativeReturn is missing", () => {
    expect(calculateAPR(undefined, daysAgo(30))).toBeUndefined();
  });

  it("returns undefined when inception timestamp is missing", () => {
    expect(calculateAPR(0.05, undefined)).toBeUndefined();
    expect(calculateAPR(0.05, 0)).toBeUndefined();
  });

  it("guards against NaN when cumulativeReturn <= -1", () => {
    expect(calculateAPR(-1, daysAgo(30))).toBeUndefined();
    expect(calculateAPR(-1.5, daysAgo(30))).toBeUndefined();
  });

  it("returns 0 APR for zero cumulative return", () => {
    expect(calculateAPR(0, daysAgo(30))).toBe(0);
  });
});
