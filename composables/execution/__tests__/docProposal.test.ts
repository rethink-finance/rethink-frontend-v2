import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { DOC, DOC_POOLS, DOC_TOKENS, DOC_UNOSWAP_RULES } from "../docConsole";
import { buildDocUnoswapProposal, describeDocUnoswapProposal } from "../docProposal";
import { rolesV1ScopeInterface } from "../indefiProposal";
import { UNOSWAP_TO2_SELECTOR, UNOSWAP_TO_SELECTOR, wordHex } from "../onchainSwap";
import { ONE_INCH_SWAP_SELECTOR } from "../oneInchSwap";

const decode = (data: string) => rolesV1ScopeInterface.parseTransaction({ data })!;

describe("the DoC whitelist proposal", () => {
  const calls = buildDocUnoswapProposal();

  it("talks only to the Roles modifier, with no value", () => {
    expect(calls).toHaveLength(8);
    for (const call of calls) {
      expect(call.target).toBe(DOC.ADDR.roles);
      expect(call.value).toBe(0n);
    }
  });

  it("pins the receiver to the Safe on both entry points", () => {
    const pins = calls.map((c) => decode(c.data)).filter((d) => d.name === "scopeParameter");
    expect(pins.map((d) => d.args.functionSig)).toEqual([UNOSWAP_TO_SELECTOR, UNOSWAP_TO2_SELECTOR]);
    for (const pin of pins) {
      expect(pin.args.role).toBe(1n);
      expect(pin.args.targetAddress).toBe(DOC.ADDR.oneInch);
      expect(pin.args.paramIndex).toBe(0n);
      expect(pin.args.paramType).toBe(0n); // Static
      expect(pin.args.paramComp).toBe(0n); // EqualTo
      expect(pin.args.compValue).toBe(wordHex(DOC.ADDR.safe));
    }
  });

  it("limits the sold token to the vault's assets and the pools by slot", () => {
    const oneOfs = calls.map((c) => decode(c.data)).filter((d) => d.name === "scopeParameterAsOneOf");
    const key = (d: ReturnType<typeof decode>) => `${d.args.functionSig}:${d.args.paramIndex}`;
    // unoswapTo: token, dex — unoswapTo2: token, dex, dex2
    expect(oneOfs.map(key)).toEqual([
      `${UNOSWAP_TO_SELECTOR}:1`,
      `${UNOSWAP_TO_SELECTOR}:4`,
      `${UNOSWAP_TO2_SELECTOR}:1`,
      `${UNOSWAP_TO2_SELECTOR}:4`,
      `${UNOSWAP_TO2_SELECTOR}:5`,
    ]);
    const tokenWords = DOC_TOKENS.map((t) => wordHex(t.address));
    const expected: Record<string, string[]> = {
      [`${UNOSWAP_TO_SELECTOR}:1`]: tokenWords,
      [`${UNOSWAP_TO_SELECTOR}:4`]: DOC_UNOSWAP_RULES.directWords.map(wordHex),
      [`${UNOSWAP_TO2_SELECTOR}:1`]: tokenWords,
      [`${UNOSWAP_TO2_SELECTOR}:4`]: DOC_UNOSWAP_RULES.firstHopWords.map(wordHex),
      [`${UNOSWAP_TO2_SELECTOR}:5`]: DOC_UNOSWAP_RULES.secondHopWords.map(wordHex),
    };
    for (const d of oneOfs) {
      expect(d.args.role).toBe(1n);
      expect(d.args.targetAddress).toBe(DOC.ADDR.oneInch);
      expect(d.args.paramType).toBe(0n); // Static
      expect([...d.args.compValues]).toEqual(expected[key(d)]);
      // Roles v1 refuses a one-of with fewer than two values.
      expect(d.args.compValues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("revokes swap() last", () => {
    const last = decode(calls[calls.length - 1].data);
    expect(last.name).toBe("scopeRevokeFunction");
    expect(last.args.role).toBe(1n);
    expect(last.args.functionSig).toBe(ONE_INCH_SWAP_SELECTOR);
    expect(last.args.targetAddress).toBe(DOC.ADDR.oneInch);
  });

  it("describes itself with every pool and every call", () => {
    const text = describeDocUnoswapProposal();
    for (const pool of DOC_POOLS) expect(text).toContain(pool.address);
    expect(text).toContain("Revoke `swap()`");
    expect(text.split("\n").filter((l) => /^\d+\. /.test(l))).toHaveLength(8);
    expect(ethers.isAddress(DOC.ADDR.roles)).toBe(true);
  });
});
