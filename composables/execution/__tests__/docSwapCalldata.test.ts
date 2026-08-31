import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  DOC,
  DOC_TOKENS,
  docOneInchSwap,
  docValidateWrapped,
  docWrappedPreview,
  parseDocSwap,
  validateDocSwap,
} from "../docConsole";
import fixture from "./mock_data/doc_swap_calldata.json";

/**
 * The fixture is a swap this vault really executed through role 1, so these
 * tests run against the exact shape 1inch produces rather than a hand-written
 * approximation of it.
 */
const CALLDATA = fixture.calldata;
const token = (symbol: string) => DOC_TOKENS.find((t) => t.symbol === symbol)!;
const leg = (sell: string, buy: string, amount: bigint) => ({
  sell: token(sell),
  buy: token(buy),
  amount,
});

describe("parseDocSwap", () => {
  it("reads a real 1inch swap the vault has executed", () => {
    const call = parseDocSwap(CALLDATA);
    expect(call.srcToken).toBe(token("DAI").address);
    expect(call.dstToken).toBe(token("WETH").address);
    expect(call.dstReceiver).toBe(DOC.ADDR.safe);
    expect(call.amount).toBe(ethers.parseUnits("2000", 18));
    expect(call.program.length).toBeGreaterThan(2);
  });

  it("refuses any entry point but the one role 1 may call", () => {
    // The v5 four-argument swap: right shape, wrong selector.
    expect(() => parseDocSwap("0x12aa3caf0000")).toThrow(/only call swap/);
    expect(() => parseDocSwap("not hex")).toThrow(/not hex calldata/);
  });
});

describe("validateDocSwap", () => {
  const call = parseDocSwap(CALLDATA);

  it("passes calldata that matches its leg", () => {
    expect(validateDocSwap(call, leg("DAI", "WETH", call.amount))).toEqual([]);
  });

  it("catches calldata built for a different leg", () => {
    expect(validateDocSwap(call, leg("DAI", "WBTC", call.amount))[0]).toMatch(/buys WETH/);
    expect(validateDocSwap(call, leg("PAXG", "WETH", call.amount))[0]).toMatch(/sells DAI/);
    expect(validateDocSwap(call, leg("DAI", "WETH", call.amount * 2n))[0]).toMatch(/off/);
  });

  it("tolerates a rounded size but not a materially different one", () => {
    // A pathfinder quote is taken at a round number; 1% is rounding, 5% is a
    // different trade.
    const near = (call.amount * 101n) / 100n;
    const far = (call.amount * 105n) / 100n;
    expect(validateDocSwap(call, leg("DAI", "WETH", near))).toEqual([]);
    expect(validateDocSwap(call, leg("DAI", "WETH", far))).toHaveLength(1);
  });

  it("rejects proceeds that would leave the Safe", () => {
    const elsewhere = { ...call, dstReceiver: "0x0000000000000000000000000000000000000dEaD" };
    expect(validateDocSwap(elsewhere, leg("DAI", "WETH", call.amount))[0]).toMatch(
      /must land in the Safe/,
    );
  });

  it("rejects a buy the modifier does not whitelist", () => {
    const unlisted = { ...call, dstToken: "0xdC685acc53CA2A760029caB2f6A587482Aa9cf57" };
    const problems = validateDocSwap(unlisted, leg("DAI", "WETH", call.amount));
    expect(problems[0]).toMatch(/six whitelisted assets/);
  });

  it("rejects a floorless fill", () => {
    const floorless = { ...call, minReturn: 0n };
    expect(validateDocSwap(floorless, leg("DAI", "WETH", call.amount)).at(-1)).toMatch(
      /minReturn is zero/,
    );
  });
});

describe("docOneInchSwap", () => {
  it("passes the pathfinder's program through byte for byte", () => {
    const call = parseDocSwap(CALLDATA);
    const inner = docOneInchSwap(call, CALLDATA, token("DAI"), token("WETH"));
    expect(inner.to).toBe(DOC.ADDR.oneInch);
    expect(inner.data).toBe(CALLDATA);
    expect(inner.params.find((p) => p.k === "dstReceiver")?.pinned).toBe(true);
  });

  it("wraps into execTransactionWithRole for role 1", () => {
    const call = parseDocSwap(CALLDATA);
    const wrapped = docWrappedPreview(docOneInchSwap(call, CALLDATA, token("DAI"), token("WETH")));
    expect(docValidateWrapped(wrapped)).toBe(true);
  });
});
