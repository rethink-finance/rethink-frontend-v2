import { describe, expect, it } from "vitest";
import {
  EXECUTION_MODE_HINTS,
  isSafeSession,
  EXECUTION_MODE_LABELS,
  resolveExecutionMode,
} from "../safeSession";

const SAFE = "0xfcF577A1b4364a55Af6C48804C8fF4a8463d7dC0";
const OTHER = "0x0000000000000000000000000000000000000001";

describe("isSafeSession", () => {
  it("recognises the Safe regardless of address casing", () => {
    expect(isSafeSession(SAFE, SAFE)).toBe(true);
    expect(isSafeSession(SAFE, SAFE.toLowerCase())).toBe(true);
    expect(isSafeSession(SAFE.toLowerCase(), SAFE)).toBe(true);
  });

  it("is false when either side is missing", () => {
    expect(isSafeSession(undefined, SAFE)).toBe(false);
    expect(isSafeSession(SAFE, undefined)).toBe(false);
    expect(isSafeSession(null, null)).toBe(false);
    expect(isSafeSession("", "")).toBe(false);
  });

  it("is false for any other wallet", () => {
    expect(isSafeSession(SAFE, OTHER)).toBe(false);
  });
});

describe("resolveExecutionMode", () => {
  it("needs a connected wallet before anything else", () => {
    expect(resolveExecutionMode(false, true, true)).toBe("none");
  });

  it("sends a Safe session unwrapped, even if it also held a role", () => {
    expect(resolveExecutionMode(true, true, false)).toBe("safe");
    expect(resolveExecutionMode(true, true, true)).toBe("safe");
  });

  it("routes a role member through the modifier, and nobody else", () => {
    expect(resolveExecutionMode(true, false, true)).toBe("curator");
    expect(resolveExecutionMode(true, false, false)).toBe("none");
  });

  it("never calls an unread membership a curator", () => {
    // The log could not be read: the buttons stay live for the dry-run to
    // gate, but the wallet is labelled as unverified, not as a curator.
    expect(resolveExecutionMode(true, false, false, true)).toBe("unverified");
    // A confirmed role, or a Safe session, wins over the unknown flag.
    expect(resolveExecutionMode(true, false, true, true)).toBe("curator");
    expect(resolveExecutionMode(true, true, false, true)).toBe("safe");
    expect(resolveExecutionMode(false, false, false, true)).toBe("none");
  });

  it("labels every live mode", () => {
    expect(EXECUTION_MODE_LABELS.safe).toMatch(/custody Safe/);
    expect(EXECUTION_MODE_LABELS.curator).toMatch(/vault curator/);
    expect(EXECUTION_MODE_LABELS.unverified).toMatch(/not verified/);
    expect(EXECUTION_MODE_HINTS.unverified).toMatch(/dry-run/);
  });

  it("explains both executable modes", () => {
    expect(EXECUTION_MODE_HINTS.safe).toMatch(/Zodiac Pilot/);
    expect(EXECUTION_MODE_HINTS.curator).toMatch(/Roles/);
  });
});
