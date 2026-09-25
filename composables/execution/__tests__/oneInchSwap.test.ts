import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  ONE_INCH_FLAG_PARTIAL_FILL,
  ONE_INCH_FLAG_REQUIRES_EXTRA_ETH,
  describeOneInchRoute,
  parseOneInchSwap,
  prettyProtocolName,
  swapImpactPct,
  validateOneInchSwap,
} from "../oneInchSwap";
import { INDEFI, INDEFI_SWAP_RULES, INDEFI_TOKENS } from "../indefiConsole";
import fixture from "./mock_data/indefi_swap_calldata.json";

/**
 * The fixtures are swaps INDEFI really executed through role 1 on Base, so
 * these tests run against the exact shape 1inch produces rather than a
 * hand-written approximation of it.
 */
const token = (symbol: string) => INDEFI_TOKENS.find((t) => t.symbol === symbol)!;
const leg = (sell: string, buy: string, amount: bigint) => ({
  sell: token(sell),
  buy: token(buy),
  amount,
});

describe("parseOneInchSwap", () => {
  it("reads the WETH → USDC swap the vault executed on 2026-09-21", () => {
    const call = parseOneInchSwap(fixture.wethToUsdc.calldata);
    expect(call.srcToken).toBe(token("WETH").address);
    expect(call.dstToken).toBe(token("USDC").address);
    expect(call.dstReceiver).toBe(INDEFI.ADDR.safe);
    expect(call.amount).toBe(1458601697248331958n);
    expect(call.minReturn).toBe(3969275285n);
    expect(call.flags).toBe(0n);
    expect(call.executor).toBe("0x111116053F09d34a7Eae8102887004445176CA11");
    expect(call.srcReceiver).toBe(call.executor);
    expect((call.program.length - 2) / 2).toBe(808);
  });

  it("reads the AERO → USDC swap from the same afternoon", () => {
    const call = parseOneInchSwap(fixture.aeroToUsdc.calldata);
    expect(call.srcToken).toBe(token("AERO").address);
    expect(call.dstToken).toBe(token("USDC").address);
    expect(call.amount).toBe(3733611636995149606412n);
    expect(call.dstReceiver).toBe(INDEFI.ADDR.safe);
  });

  it("refuses any entry point but swap()", () => {
    // unoswapTo: right router, the selector the modifier refuses.
    expect(() => parseOneInchSwap("0xe2c95c82" + "00".repeat(160))).toThrow(/only call swap/);
    // The whole Roles wrap pasted by mistake.
    expect(() => parseOneInchSwap(fixture.wethToUsdc.wrapped)).toThrow(/0x6928e74b/);
    expect(() => parseOneInchSwap("not hex")).toThrow(/not hex calldata/);
  });

  it("names a truncated paste for what it is", () => {
    const clipped = fixture.wethToUsdc.calldata.slice(0, 400);
    expect(() => parseOneInchSwap(clipped)).toThrow(/truncated/);
  });
});

describe("validateOneInchSwap", () => {
  const call = parseOneInchSwap(fixture.wethToUsdc.calldata);

  it("passes calldata that matches its leg", () => {
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "USDC", call.amount))).toEqual([]);
  });

  it("catches calldata built for a different leg", () => {
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "AERO", call.amount))[0]).toMatch(
      /buys USDC/,
    );
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("USDC", "USDC", call.amount))[0]).toMatch(
      /sells WETH/,
    );
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "USDC", call.amount * 2n))[0]).toMatch(
      /off/,
    );
  });

  it("tolerates a rounded size but not a materially different one", () => {
    const near = (call.amount * 101n) / 100n;
    const far = (call.amount * 105n) / 100n;
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "USDC", near))).toEqual([]);
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "USDC", far))).toHaveLength(1);
    // A quote built here is exact, so its tolerance can be zero.
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "USDC", near), 0)).toHaveLength(1);
    expect(validateOneInchSwap(call, INDEFI_SWAP_RULES, leg("WETH", "USDC", call.amount), 0)).toEqual([]);
  });

  it("rejects proceeds that would leave the Safe", () => {
    const elsewhere = { ...call, dstReceiver: "0x000000000000000000000000000000000000dEaD" };
    expect(validateOneInchSwap(elsewhere, INDEFI_SWAP_RULES, leg("WETH", "USDC", call.amount))[0]).toMatch(
      /must land in the Safe/,
    );
  });

  it("rejects a buy the modifier does not whitelist", () => {
    const unlisted = { ...call, dstToken: "0xdC685acc53CA2A760029caB2f6A587482Aa9cf57" };
    const problems = validateOneInchSwap(unlisted, INDEFI_SWAP_RULES, leg("WETH", "USDC", call.amount));
    expect(problems[0]).toMatch(/only allows buying USDC, WETH, AERO/);
  });

  it("rejects a floorless fill, a partial fill and a swap that wants ETH", () => {
    const intent = leg("WETH", "USDC", call.amount);
    expect(validateOneInchSwap({ ...call, minReturn: 0n }, INDEFI_SWAP_RULES, intent)[0]).toMatch(
      /minReturn is zero/,
    );
    expect(
      validateOneInchSwap({ ...call, flags: ONE_INCH_FLAG_PARTIAL_FILL }, INDEFI_SWAP_RULES, intent)[0],
    ).toMatch(/partial fill/);
    expect(
      validateOneInchSwap(
        { ...call, flags: ONE_INCH_FLAG_REQUIRES_EXTRA_ETH },
        INDEFI_SWAP_RULES,
        intent,
      )[0],
    ).toMatch(/expects ETH/);
  });
});

describe("route and impact", () => {
  it("prints protocol names without the chain prefix", () => {
    expect(prettyProtocolName("BASE_AERODROME_V3")).toBe("Aerodrome V3");
    expect(prettyProtocolName("UNISWAP_V3")).toBe("Uniswap V3");
    expect(prettyProtocolName("BASE_PANCAKESWAP_V3")).toBe("Pancakeswap V3");
  });

  it("describes a split, multi-hop route on one line", () => {
    const protocols = [
      [
        [
          { name: "BASE_AERODROME_V3", part: 70 },
          { name: "BASE_UNISWAP_V3", part: 30 },
        ],
        [{ name: "BASE_UNISWAP_V3", part: 100 }],
      ],
    ];
    expect(describeOneInchRoute(protocols)).toBe("Aerodrome V3 70% + Uniswap V3 30% → Uniswap V3");
    expect(describeOneInchRoute(undefined)).toBe("");
    expect(describeOneInchRoute([])).toBe("");
  });

  it("measures the fill against oracle marks", () => {
    const usdc = token("USDC");
    const weth = token("WETH");
    // 2,650 USDC for 0.99 WETH at 2,650 USD/ETH: 1% given up.
    const pct = swapImpactPct(
      ethers.parseUnits("2650", usdc.decimals),
      usdc,
      1,
      ethers.parseUnits("0.99", weth.decimals),
      weth,
      2650,
    );
    expect(pct).toBeCloseTo(-1, 6);
    expect(swapImpactPct(1n, usdc, 0, 1n, weth, 2650)).toBe(0);
  });
});
