import { describe, expect, it } from "vitest";
import { MIN_QUORUM_PERCENT, formRules } from "../formRules";

describe("formRules.quorumAtLeastMinimum", () => {
  const rule = formRules.quorumAtLeastMinimum;

  it("has a 10% floor", () => {
    expect(MIN_QUORUM_PERCENT).toBe(10);
  });

  it("passes a quorum at or above the floor, typed or formatted", () => {
    expect(rule("10")).toBe(true);
    expect(rule(10)).toBe(true);
    expect(rule("50")).toBe(true);
    // A vault reports its quorum already formatted.
    expect(rule("10%")).toBe(true);
    expect(rule("100%")).toBe(true);
  });

  it("refuses anything under the floor, zero included", () => {
    expect(rule("9.99")).not.toBe(true);
    expect(rule("4%")).not.toBe(true);
    expect(rule("0")).not.toBe(true);
    expect(rule(0)).not.toBe(true);
    expect(rule("0%")).not.toBe(true);
    expect(rule("-1")).not.toBe(true);
  });

  it("refuses a quorum that is not a number at all", () => {
    expect(rule("")).not.toBe(true);
    expect(rule(undefined)).not.toBe(true);
    expect(rule(null)).not.toBe(true);
    expect(rule("N/A")).not.toBe(true);
  });

  it("names the floor in its message", () => {
    expect(rule("0")).toMatch(/at least 10%/);
  });
});
