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

describe("formRules.percentAtMost", () => {
  const atMost10 = formRules.percentAtMost(10);

  it("passes a percentage at or under the ceiling", () => {
    expect(atMost10("10")).toBe(true);
    expect(atMost10(10)).toBe(true);
    expect(atMost10("0")).toBe(true);
    expect(atMost10("9.5")).toBe(true);
  });

  it("refuses anything over it", () => {
    expect(atMost10("10.01")).not.toBe(true);
    expect(atMost10(11)).not.toBe(true);
    expect(atMost10("100")).not.toBe(true);
  });

  it("leaves an empty field to the required rule", () => {
    expect(atMost10("")).toBe(true);
    expect(atMost10(undefined)).toBe(true);
    expect(atMost10(null)).toBe(true);
  });

  it("refuses a value that is not a number", () => {
    expect(atMost10("abc")).not.toBe(true);
  });

  it("names the ceiling in its message", () => {
    expect(formRules.percentAtMost(50)("51")).toMatch(/at most 50%/);
  });
});
