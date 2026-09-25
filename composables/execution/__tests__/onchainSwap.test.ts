import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  UNISWAP_V3_PROTOCOL_FLAG,
  UNOSWAP_TO2_SELECTOR,
  UNOSWAP_TO_SELECTOR,
  WETH_UNWRAP_FLAG,
  ZERO_FOR_ONE_FLAG,
  allowedDexWords,
  buildUnoswap,
  dexWord,
  minReturnFor,
  parseUnoswap,
  routesBetween,
  validateUnoswap,
  wordHex,
} from "../onchainSwap";
import { ONE_INCH_ROUTER_V6 } from "../oneInchSwap";
import { INDEFI, INDEFI_POOLS, INDEFI_TOKENS, INDEFI_UNOSWAP_RULES } from "../indefiConsole";

const token = (symbol: string) => INDEFI_TOKENS.find((t) => t.symbol === symbol)!;
const USDC = token("USDC");
const WETH = token("WETH");
const AERO = token("AERO");
const POOL_5BP = "0xd0b53D9277642d899DF5C87A3966A349A798F224";

describe("dex words", () => {
  it("tags Uniswap V3, sets the direction from the address order, keeps the pool", () => {
    // WETH (0x42…) sorts before USDC (0x83…), so WETH is token0: selling USDC is one-for-zero.
    const usdcToWeth = dexWord(POOL_5BP, USDC.address, WETH.address);
    const wethToUsdc = dexWord(POOL_5BP, WETH.address, USDC.address);
    expect(usdcToWeth & UNISWAP_V3_PROTOCOL_FLAG).toBe(UNISWAP_V3_PROTOCOL_FLAG);
    expect(usdcToWeth & ZERO_FOR_ONE_FLAG).toBe(0n);
    expect(wethToUsdc & ZERO_FOR_ONE_FLAG).toBe(ZERO_FOR_ONE_FLAG);
    expect(usdcToWeth & ((1n << 160n) - 1n)).toBe(BigInt(POOL_5BP));
    expect(usdcToWeth & WETH_UNWRAP_FLAG).toBe(0n);
    // The very word the fork rehearsal used for this pool and direction.
    expect(wordHex(usdcToWeth)).toBe("0x2" + "0".repeat(23) + POOL_5BP.slice(2).toLowerCase());
    // bit 253 → the leading 2; bit 247 → the 8 two digits later.
    expect(wordHex(wethToUsdc)).toBe("0x208" + "0".repeat(21) + POOL_5BP.slice(2).toLowerCase());
  });

  it("lists both directions of every pool, and nothing else", () => {
    const words = allowedDexWords(INDEFI_POOLS);
    expect(words).toHaveLength(INDEFI_POOLS.length * 2);
    expect(new Set(words).size).toBe(words.length);
    expect(INDEFI_UNOSWAP_RULES.dexWords).toEqual(words);
  });
});

describe("routes", () => {
  it("finds the direct pools and two-hop paths inside the list", () => {
    const direct = routesBetween(INDEFI_POOLS, USDC, WETH);
    expect(direct.filter((r) => r.hops.length === 1)).toHaveLength(3);
    // USDC → AERO → WETH through the two AERO pools is a legal two-hop.
    expect(direct.some((r) => r.hops.length === 2 && r.hops[0].buy.symbol === "AERO")).toBe(true);
    const aero = routesBetween(INDEFI_POOLS, USDC, AERO);
    expect(aero.filter((r) => r.hops.length === 1)).toHaveLength(1);
    expect(aero[0].label).toBe("USDC → AERO · Uniswap V3 AERO/USDC 0.05%");
  });

  it("never routes through a pool that does not carry the pair", () => {
    const fake = { symbol: "X", address: "0x000000000000000000000000000000000000000f", decimals: 18 };
    expect(routesBetween(INDEFI_POOLS, fake, WETH)).toEqual([]);
  });
});

describe("buildUnoswap / parseUnoswap / validateUnoswap", () => {
  const route = routesBetween(INDEFI_POOLS, USDC, WETH).find(
    (r) => r.hops.length === 1 && r.hops[0].pool.address === POOL_5BP,
  )!;
  const amountIn = ethers.parseUnits("1000", 6);
  const minReturn = ethers.parseUnits("0.37", 18);
  const { to, data } = buildUnoswap({ safe: INDEFI.ADDR.safe, route, amountIn, minReturn });

  it("is an unoswapTo on the v6 router with the proceeds pinned to the Safe", () => {
    expect(to).toBe(ONE_INCH_ROUTER_V6);
    const call = parseUnoswap(data);
    expect(call.selector).toBe(UNOSWAP_TO_SELECTOR);
    expect(call.to).toBe(INDEFI.ADDR.safe);
    expect(call.token).toBe(USDC.address);
    expect(call.amount).toBe(amountIn);
    expect(call.minReturn).toBe(minReturn);
    expect(call.dex).toEqual([dexWord(POOL_5BP, USDC.address, WETH.address)]);
    expect(validateUnoswap(call, INDEFI_UNOSWAP_RULES, { sell: USDC, buy: WETH, amount: amountIn })).toEqual([]);
  });

  it("uses unoswapTo2 for a two-hop path", () => {
    const twoHop = routesBetween(INDEFI_POOLS, USDC, WETH).find((r) => r.hops.length === 2)!;
    const built = buildUnoswap({ safe: INDEFI.ADDR.safe, route: twoHop, amountIn, minReturn: 1n });
    const call = parseUnoswap(built.data);
    expect(call.selector).toBe(UNOSWAP_TO2_SELECTOR);
    expect(call.dex).toHaveLength(2);
    expect(validateUnoswap(call, INDEFI_UNOSWAP_RULES, { sell: USDC, buy: WETH, amount: amountIn })).toEqual([]);
  });

  it("refuses everything the whitelist refuses", () => {
    const call = parseUnoswap(data);
    const intent = { sell: USDC, buy: WETH, amount: amountIn };
    expect(validateUnoswap({ ...call, to: "0x000000000000000000000000000000000000dEaD" }, INDEFI_UNOSWAP_RULES, intent)[0]).toMatch(/Safe/);
    expect(validateUnoswap({ ...call, token: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" }, INDEFI_UNOSWAP_RULES, intent)[0]).toMatch(/selling/);
    // An Aerodrome pool, and a listed pool with the unwrap flag: both off the list.
    const aeroPool = dexWord("0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59", USDC.address, WETH.address);
    expect(validateUnoswap({ ...call, dex: [aeroPool] }, INDEFI_UNOSWAP_RULES, intent)[0]).toMatch(/not on the whitelist/);
    expect(validateUnoswap({ ...call, dex: [call.dex[0] | WETH_UNWRAP_FLAG] }, INDEFI_UNOSWAP_RULES, intent)[0]).toMatch(/not on the whitelist/);
    expect(validateUnoswap({ ...call, minReturn: 0n }, INDEFI_UNOSWAP_RULES, intent)[0]).toMatch(/minReturn is zero/);
    expect(validateUnoswap({ ...call, amount: amountIn + 1n }, INDEFI_UNOSWAP_RULES, intent)[0]).toMatch(/amount/);
  });

  it("rejects calldata that is not unoswapTo", () => {
    expect(() => parseUnoswap("0x07ed2379" + "00".repeat(64))).toThrow(/Not an unoswapTo call/);
    expect(() => parseUnoswap("nope")).toThrow(/not hex/);
  });
});

describe("numbers", () => {
  it("applies the tolerance to the floor", () => {
    expect(minReturnFor(1_000_000n, 1)).toBe(990_000n);
    expect(minReturnFor(1_000_000n, 0.5)).toBe(995_000n);
  });
});
