import { describe, expect, it } from "vitest";

import {
  hasRecordedNavValue,
  sumRecordedNavValues,
} from "~/composables/nav/recordedNavValue";

describe("sumRecordedNavValues", () => {
  it("reads an empty list as zero: the calculator stores nothing for a method valued at zero", () => {
    expect(sumRecordedNavValues([])).toBe(0n);
    expect(sumRecordedNavValues()).toBe(0n);
  });

  it("adds every value of a method", () => {
    expect(sumRecordedNavValues([286801153866578040n])).toBe(286801153866578040n);
    expect(sumRecordedNavValues([5n, 7n, 11n])).toBe(23n);
  });

  it("keeps the sign of a method that subtracts from the NAV", () => {
    expect(sumRecordedNavValues([10n, -25n])).toBe(-15n);
  });

  it("takes values an RPC returned as text or numbers", () => {
    expect(sumRecordedNavValues(["286801153866578040", 2])).toBe(286801153866578042n);
  });
});

describe("hasRecordedNavValue", () => {
  it("counts zero as a value", () => {
    expect(hasRecordedNavValue(0n)).toBe(true);
    expect(hasRecordedNavValue(0)).toBe(true);
    expect(hasRecordedNavValue("0")).toBe(true);
  });

  it("counts amounts on either side of zero", () => {
    expect(hasRecordedNavValue(286801153866578040n)).toBe(true);
    expect(hasRecordedNavValue(-1n)).toBe(true);
  });

  it("has nothing to show for a value that was never read", () => {
    expect(hasRecordedNavValue(undefined)).toBe(false);
    expect(hasRecordedNavValue(null)).toBe(false);
    expect(hasRecordedNavValue("")).toBe(false);
  });
});
