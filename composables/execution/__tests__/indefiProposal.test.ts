import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  buildIndefiUnoswapProposal,
  describeIndefiUnoswapProposal,
  rolesV1ScopeInterface,
} from "../indefiProposal";
import { INDEFI, INDEFI_POOLS, INDEFI_TOKENS } from "../indefiConsole";
import {
  UNOSWAP_TO2_SELECTOR,
  UNOSWAP_TO_SELECTOR,
  allowedDexWords,
  wordHex,
} from "../onchainSwap";
import { ONE_INCH_SWAP_SELECTOR } from "../oneInchSwap";

const decode = (data: string) => rolesV1ScopeInterface.parseTransaction({ data })!;

describe("the INDEFI whitelist proposal", () => {
  const calls = buildIndefiUnoswapProposal();

  it("talks only to the Roles modifier, with no value", () => {
    expect(calls).toHaveLength(8);
    for (const call of calls) {
      expect(call.target).toBe(INDEFI.ADDR.roles);
      expect(call.value).toBe(0n);
    }
  });

  it("pins the receiver to the Safe on both entry points", () => {
    const pins = calls.map((c) => decode(c.data)).filter((d) => d.name === "scopeParameter");
    expect(pins.map((d) => d.args.functionSig)).toEqual([UNOSWAP_TO_SELECTOR, UNOSWAP_TO2_SELECTOR]);
    for (const pin of pins) {
      expect(pin.args.role).toBe(1n);
      expect(pin.args.targetAddress).toBe(INDEFI.ADDR.oneInch);
      expect(pin.args.paramIndex).toBe(0n);
      expect(pin.args.paramType).toBe(0n); // Static
      expect(pin.args.paramComp).toBe(0n); // EqualTo
      expect(pin.args.compValue).toBe(wordHex(INDEFI.ADDR.safe));
    }
  });

  it("limits the sold token to the vault's assets and the pools to the list", () => {
    const oneOfs = calls.map((c) => decode(c.data)).filter((d) => d.name === "scopeParameterAsOneOf");
    // unoswapTo: token, dex — unoswapTo2: token, dex, dex2
    expect(oneOfs.map((d) => `${d.args.functionSig}:${d.args.paramIndex}`)).toEqual([
      `${UNOSWAP_TO_SELECTOR}:1`,
      `${UNOSWAP_TO_SELECTOR}:4`,
      `${UNOSWAP_TO2_SELECTOR}:1`,
      `${UNOSWAP_TO2_SELECTOR}:4`,
      `${UNOSWAP_TO2_SELECTOR}:5`,
    ]);
    const tokenWords = INDEFI_TOKENS.map((t) => wordHex(t.address));
    const poolWords = allowedDexWords(INDEFI_POOLS).map(wordHex);
    for (const d of oneOfs) {
      const values = [...d.args.compValues];
      expect(values).toEqual(d.args.paramIndex === 1n ? tokenWords : poolWords);
    }
    expect(poolWords).toHaveLength(10);
  });

  it("revokes swap() last", () => {
    const last = decode(calls[calls.length - 1].data);
    expect(last.name).toBe("scopeRevokeFunction");
    expect(last.args.functionSig).toBe(ONE_INCH_SWAP_SELECTOR);
    expect(last.args.targetAddress).toBe(INDEFI.ADDR.oneInch);
  });

  it("describes itself with every pool and every call", () => {
    const text = describeIndefiUnoswapProposal();
    for (const pool of INDEFI_POOLS) expect(text).toContain(pool.address);
    expect(text).toContain("Revoke `swap()`");
    expect(text.split("\n").filter((l) => /^\d+\. /.test(l))).toHaveLength(8);
    expect(ethers.isAddress(INDEFI.ADDR.roles)).toBe(true);
  });
});
