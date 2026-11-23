import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  IF,
  SNI_POOL,
  SYC,
  SYC_ONEINCH_ROUTE,
  SYC_PATHS,
  SYC_BUY_PATHS,
  SYC_POOLS,
  SYC_SELECTORS,
  SYC_SPENDERS,
  SYC_TOKENS,
  accruedAllowance,
  amountsForLiquidity,
  buildApprove,
  buildCollect,
  buildDecreaseLiquidity,
  buildIncreaseLiquidity,
  buildOneInchSwap,
  buildSwap,
  buildUniswapSwap,
  isFullRange,
  isOneInchRoute,
  lessPct,
  liquidityForAmount0,
  minReturnFor,
  pairedAmount,
  parseAmount,
  parsePct,
  routePath,
  singleSide,
  sqrtRatioAtTick,
  swapCandidates,
  sycExplainDenial,
  sycOneInchRoute,
  sycPoolFor,
  sycRoutesBetween,
  sycToken,
  sycValidate,
  tickToPrice,
  type SycAllowance,
} from "../sycConsole";
import { buildUnoswap, dexWord, wordHex } from "../onchainSwap";
import { ONE_INCH_ROUTER_V6 } from "../oneInchSwap";
import stored from "./mock_data/syc_permissions.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";

const WETH = sycToken("WETH");
const USDC = sycToken("USDC");
const SNI = sycToken("SNI");
const A = SYC.ADDR;
const STRANGER = "0x000000000000000000000000000000000000bEEF";
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const coder = ethers.AbiCoder.defaultAbiCoder();

/* -------------------------------------------------------------------------- */
/* What the modifier stores, read back from the batch it was given              */
/* -------------------------------------------------------------------------- */

interface StoredScope {
  role: string;
  target: string;
  selector: string;
  /** Every non-empty compValue in the condition tree, as stored. */
  values: string[];
  /** Operators present in the tree. */
  operators: number[];
}

const scopes = (entries: string[]): StoredScope[] =>
  entries
    .map((data) => rolesIface.parseTransaction({ data })!)
    .filter((p) => p.name === "scopeFunction")
    .map((p) => ({
      role: ethers.decodeBytes32String(p.args[0]),
      target: (p.args[1] as string).toLowerCase(),
      selector: (p.args[2] as string).toLowerCase(),
      values: (p.args[3] as any[]).map((c) => String(c[3]).toLowerCase()).filter((v) => v !== "0x"),
      operators: (p.args[3] as any[]).map((c) => Number(c[2])),
    }));

const EXECUTOR = scopes(stored.executor);
const BUYBACK = scopes(stored.buyback);
const scopeOf = (list: StoredScope[], target: string, selector: string) =>
  list.find((s) => s.target === target.toLowerCase() && s.selector === selector.toLowerCase());
const addressWord = (a: string) => coder.encode(["address"], [a]).toLowerCase();
const bytesWord = (b: string) => coder.encode(["bytes"], [b]).toLowerCase();
const sameSet = (a: string[], b: string[]) => expect([...new Set(a)].sort()).toEqual([...new Set(b)].sort());

describe("the console's constants are what the modifier stores", () => {
  it("routes under the two role keys the batch scoped", () => {
    expect(new Set(EXECUTOR.map((s) => s.role))).toEqual(new Set([SYC.ROLE]));
    expect(new Set(BUYBACK.map((s) => s.role))).toEqual(new Set([SYC.BUYBACK_ROLE]));
    expect(SYC.ROLE).toBe("defaultManagerRole");
    expect(SYC.BUYBACK_ROLE).toBe("Buyback-Executor");
  });

  it("knows exactly the executor's scoped functions", () => {
    const pairs = EXECUTOR.map((s) => `${s.target}:${s.selector}`).sort();
    const expected = [
      ...SYC_TOKENS.map((t) => `${t.address}:${SYC_SELECTORS.approve}`),
      `${A.router02}:${SYC_SELECTORS.exactInputSingle}`,
      `${A.router02}:${SYC_SELECTORS.exactOutputSingle}`,
      `${A.router02}:${SYC_SELECTORS.exactInput}`,
      `${A.router02}:${SYC_SELECTORS.exactOutput}`,
      `${A.npm}:${SYC_SELECTORS.increaseLiquidity}`,
      `${A.npm}:${SYC_SELECTORS.decreaseLiquidity}`,
      `${A.npm}:${SYC_SELECTORS.collect}`,
      `${A.oneInch}:${SYC_SELECTORS.unoswapTo2}`,
    ].map((s) => s.toLowerCase()).sort();
    expect(pairs).toEqual(expected);
  });

  it("approves only to the three spenders the batch pinned", () => {
    for (const token of SYC_TOKENS) {
      sameSet(scopeOf(EXECUTOR, token.address, SYC_SELECTORS.approve)!.values, SYC_SPENDERS.map(addressWord));
    }
  });

  it("trades only the three tokens on single hops, proceeds to the Safe", () => {
    for (const sel of [SYC_SELECTORS.exactInputSingle, SYC_SELECTORS.exactOutputSingle]) {
      sameSet(scopeOf(EXECUTOR, A.router02, sel)!.values, [...SYC_TOKENS.map((t) => addressWord(t.address)), addressWord(A.safe)]);
    }
  });

  it("writes exactly the eight two-hop paths the batch pinned", () => {
    for (const sel of [SYC_SELECTORS.exactInput, SYC_SELECTORS.exactOutput]) {
      sameSet(scopeOf(EXECUTOR, A.router02, sel)!.values, [...SYC_PATHS.map(bytesWord), addressWord(A.safe)]);
    }
    expect(SYC_PATHS).toHaveLength(8);
  });

  it("writes the 1inch route word for word, for both roles", () => {
    const expected = [addressWord(A.safe), addressWord(WETH.address), wordHex(SYC_ONEINCH_ROUTE.dex), wordHex(SYC_ONEINCH_ROUTE.dex2)];
    for (const v of expected) expect(scopeOf(EXECUTOR, A.oneInch, SYC_SELECTORS.unoswapTo2)!.values).toContain(v.toLowerCase());
    expect(wordHex(SYC_ONEINCH_ROUTE.dex)).toBe("0x200000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9");
    expect(wordHex(SYC_ONEINCH_ROUTE.dex2)).toBe("0x2080000000000000000000009ecb733a74b48ee31586c98986f0aa1ed5057c6a");
    const bb = scopeOf(BUYBACK, A.oneInch, SYC_SELECTORS.unoswapTo2)!;
    for (const v of expected) expect(bb.values).toContain(v.toLowerCase());
  });

  it("caps a buyback at 0.5 WETH and the shared daily allowance, on both of its routes", () => {
    for (const bb of [scopeOf(BUYBACK, A.oneInch, SYC_SELECTORS.unoswapTo2)!, scopeOf(BUYBACK, A.router02, SYC_SELECTORS.exactInput)!]) {
      // LessThan (18) 0.5 WETH + 1, WithinAllowance (28) on the allowance key.
      expect(bb.operators).toContain(18);
      expect(bb.operators).toContain(28);
      expect(bb.values).toContain(ethers.zeroPadValue(ethers.toBeHex(SYC.BUYBACK_MAX + 1n), 32).toLowerCase());
      expect(bb.values).toContain(SYC.BUYBACK_ALLOWANCE_KEY.toLowerCase());
    }
    // Uniswap: only the four WETH → USDC → SNI paths, proceeds to the Safe.
    const uni = scopeOf(BUYBACK, A.router02, SYC_SELECTORS.exactInput)!;
    for (const path of SYC_BUY_PATHS) expect(uni.values).toContain(bytesWord(path));
    expect(uni.values.filter((v) => v.length === bytesWord(SYC_BUY_PATHS[0]).length)).toHaveLength(4);
    expect(uni.values).toContain(addressWord(A.safe));
    expect(stored.allowance.key).toBe(SYC.BUYBACK_ALLOWANCE_KEY.toLowerCase());
    expect(BigInt(stored.allowance.maxRefill)).toBe(SYC.BUYBACK_MAX);
  });

  it("gates positions on the Safe owning them and collects only to the Safe", () => {
    const custom = 22; // AvatarIsOwnerOfERC721
    for (const sel of [SYC_SELECTORS.increaseLiquidity, SYC_SELECTORS.decreaseLiquidity, SYC_SELECTORS.collect]) {
      expect(scopeOf(EXECUTOR, A.npm, sel)!.operators).toContain(custom);
    }
    expect(scopeOf(EXECUTOR, A.npm, SYC_SELECTORS.collect)!.values).toContain(addressWord(A.safe));
  });

  it("lists the five pools with the pool's own token order, fee and spacing", () => {
    expect(SYC_POOLS).toHaveLength(5);
    for (const p of SYC_POOLS) {
      expect(p.tokens[0].symbol).toBe("USDC");
      expect(p.tokens[0].address.toLowerCase() < p.tokens[1].address.toLowerCase()).toBe(true);
      expect({ 100: 1, 500: 10, 3000: 60, 10000: 200 }[p.fee]).toBe(p.tickSpacing);
    }
    expect(SYC_POOLS.filter((p) => p.tokens[1].symbol === "WETH").map((p) => p.fee)).toEqual([100, 500, 3000, 10000]);
    expect(sycPoolFor(USDC.address, SNI.address, 3000)).toBe(SNI_POOL);
  });
});

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

describe("routes", () => {
  it("finds every pool route: four WETH/USDC tiers, one SNI/USDC, four SNI ⇄ WETH two-hops", () => {
    expect(sycRoutesBetween(WETH, USDC).map((r) => r.hops.length)).toEqual([1, 1, 1, 1]);
    expect(sycRoutesBetween(USDC, WETH)).toHaveLength(4);
    expect(sycRoutesBetween(USDC, SNI).map((r) => r.hops.length)).toEqual([1]);
    expect(sycRoutesBetween(SNI, USDC)).toHaveLength(1);
    expect(sycRoutesBetween(WETH, SNI).map((r) => r.hops.length)).toEqual([2, 2, 2, 2]);
    expect(sycRoutesBetween(SNI, WETH).map((r) => r.hops.length)).toEqual([2, 2, 2, 2]);
    expect(sycRoutesBetween(SNI, SNI)).toEqual([]);
  });

  it("packs every two-hop route as one of the pinned paths", () => {
    const paths = [...sycRoutesBetween(WETH, SNI), ...sycRoutesBetween(SNI, WETH)].map((r) => routePath(r).toLowerCase());
    sameSet(paths, SYC_PATHS);
  });

  it("offers 1inch only on the pinned WETH → USDC 0.05% → SNI route", () => {
    expect(sycRoutesBetween(WETH, SNI).filter(isOneInchRoute)).toHaveLength(1);
    expect(sycOneInchRoute().hops.map((h) => h.pool.address)).toEqual([A.poolUsdcWeth500, A.poolUsdcSni]);
    expect(swapCandidates(WETH, SNI).map((c) => c.venue).sort()).toEqual(["oneInch", "uniswap", "uniswap", "uniswap", "uniswap"]);
    expect(swapCandidates(SNI, WETH).every((c) => c.venue === "uniswap")).toBe(true);
    expect(swapCandidates(WETH, USDC).every((c) => c.venue === "uniswap")).toBe(true);
    expect(() => buildOneInchSwap({ route: sycRoutesBetween(SNI, WETH)[0], amountIn: 1n, minReturn: 1n })).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Every call the console builds passes the validator                          */
/* -------------------------------------------------------------------------- */

describe("calls the console builds pass the grants", () => {
  const pairs: [typeof WETH, typeof WETH][] = [];
  for (const a of SYC_TOKENS) for (const b of SYC_TOKENS) if (a !== b) pairs.push([a, b]);

  it("every swap candidate, both venues", () => {
    let count = 0;
    for (const [sell, buy] of pairs) {
      for (const { venue, route } of swapCandidates(sell, buy)) {
        const call = buildSwap(venue, { route, amountIn: 10n ** 6n, minReturn: 1n });
        expect(sycValidate(call), `${venue} ${sell.symbol}→${buy.symbol}`).toEqual([]);
        count++;
      }
    }
    expect(count).toBe(4 + 4 + 1 + 1 + 5 + 4);
  });

  it("Uniswap single hops carry the pool's fee and the Safe as recipient", () => {
    for (const route of sycRoutesBetween(WETH, USDC)) {
      const [p] = IF.router02.decodeFunctionData("exactInputSingle", buildUniswapSwap({ route, amountIn: 1n, minReturn: 1n }).data);
      expect(Number(p.fee)).toBe(SYC_POOLS.find((x) => x.address === route.hops[0].pool.address)!.fee);
      expect(p.recipient).toBe(A.safe);
    }
  });

  it("approvals: the token's own contract, one of the three spenders, unlimited", () => {
    for (const token of SYC_TOKENS) {
      for (const spender of SYC_SPENDERS) {
        const call = buildApprove(token, spender);
        expect(call.to).toBe(token.address);
        const [s, amount] = IF.erc20.decodeFunctionData("approve", call.data);
        expect(s).toBe(spender);
        expect(amount).toBe(ethers.MaxUint256);
        expect(sycValidate(call)).toEqual([]);
      }
    }
  });

  it("positions: increase, decrease and collect on the Safe's own ids", () => {
    const ctx = { ownedTokenIds: [7n] };
    const calls = [
      buildIncreaseLiquidity({ tokenId: 7n, amount0Desired: 1n, amount1Desired: 1n, amount0Min: 0n, amount1Min: 0n, deadline: 1n }),
      buildDecreaseLiquidity({ tokenId: 7n, liquidity: 1n, amount0Min: 0n, amount1Min: 0n, deadline: 1n }),
      buildCollect(7n),
    ];
    for (const call of calls) expect(sycValidate(call, "executor", ctx)).toEqual([]);
    for (const call of calls) expect(sycValidate({ ...call, data: call.data.replace(/0{63}7/, "0".repeat(63) + "8") }, "executor", ctx).join(" ")).toMatch(/not owned by the Safe/);
    const [c] = IF.npm.decodeFunctionData("collect", buildCollect(7n).data);
    expect(c.recipient).toBe(A.safe);
  });

  it("the buyback: the pinned 1inch route or Uniswap through USDC, within 0.5 WETH", () => {
    const route = sycOneInchRoute();
    expect(sycValidate(buildOneInchSwap({ route, amountIn: SYC.BUYBACK_MAX, minReturn: 1n }), "buyback")).toEqual([]);
    expect(sycValidate(buildOneInchSwap({ route, amountIn: SYC.BUYBACK_MAX + 1n, minReturn: 1n }), "buyback").join(" ")).toMatch(/at most 0.5 WETH/);
    expect(sycValidate(buildUniswapSwap({ route, amountIn: SYC.BUYBACK_MAX, minReturn: 1n }), "buyback")).toEqual([]);
    expect(sycValidate(buildUniswapSwap({ route, amountIn: SYC.BUYBACK_MAX + 1n, minReturn: 1n }), "buyback").join(" ")).toMatch(/at most 0.5 WETH/);
    // the reverse path and a single-pool swap are not the buyback's
    const back = { ...route, hops: [...route.hops].reverse().map((h) => ({ ...h, sell: h.buy, buy: h.sell })) };
    expect(sycValidate(buildUniswapSwap({ route: back, amountIn: 1n, minReturn: 1n }), "buyback").join(" ")).toMatch(/WETH → USDC/);
    expect(sycValidate(buildUniswapSwap({ route: { ...route, hops: [route.hops[0]] }, amountIn: 1n, minReturn: 1n }), "buyback").join(" ")).toMatch(/may only buy SNI/);
  });
});

/* -------------------------------------------------------------------------- */
/* The validator refuses what the modifier refuses                            */
/* -------------------------------------------------------------------------- */

describe("the validator refuses what the modifier refuses", () => {
  const route = sycOneInchRoute();

  it("a stranger as receiver, on every entry point", () => {
    const single = IF.router02.encodeFunctionData("exactInputSingle", [{ tokenIn: WETH.address, tokenOut: USDC.address, fee: 500, recipient: STRANGER, amountIn: 1n, amountOutMinimum: 1n, sqrtPriceLimitX96: 0n }]);
    const multi = IF.router02.encodeFunctionData("exactInput", [{ path: SYC_PATHS[0], recipient: STRANGER, amountIn: 1n, amountOutMinimum: 1n }]);
    const oneInch = buildUnoswap({ safe: STRANGER, route, amountIn: 1n, minReturn: 1n });
    const collect = IF.npm.encodeFunctionData("collect", [{ tokenId: 1n, recipient: STRANGER, amount0Max: 1n, amount1Max: 1n }]);
    for (const call of [{ to: A.router02, data: single }, { to: A.router02, data: multi }, oneInch, { to: A.npm, data: collect }]) {
      expect(sycValidate(call).join(" ")).toMatch(/Safe/);
    }
    expect(sycValidate(oneInch, "buyback").join(" ")).toMatch(/Safe/);
  });

  it("tokens, pools and paths outside the set", () => {
    const usdce = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const single = IF.router02.encodeFunctionData("exactInputSingle", [{ tokenIn: WETH.address, tokenOut: usdce, fee: 500, recipient: A.safe, amountIn: 1n, amountOutMinimum: 1n, sqrtPriceLimitX96: 0n }]);
    expect(sycValidate({ to: A.router02, data: single })).not.toEqual([]);
    const badPath = ethers.solidityPacked(["address", "uint24", "address", "uint24", "address"], [SNI.address, 500, USDC.address, 500, WETH.address]);
    const multi = IF.router02.encodeFunctionData("exactInput", [{ path: badPath, recipient: A.safe, amountIn: 1n, amountOutMinimum: 1n }]);
    expect(sycValidate({ to: A.router02, data: multi })).not.toEqual([]);
    const reverse = buildUnoswap({ safe: A.safe, route: sycRoutesBetween(SNI, WETH)[1], amountIn: 1n, minReturn: 1n });
    expect(sycValidate(reverse)).not.toEqual([]);
    const otherTier = buildUnoswap({ safe: A.safe, route: sycRoutesBetween(WETH, SNI).find((r) => !isOneInchRoute(r))!, amountIn: 1n, minReturn: 1n });
    expect(sycValidate(otherTier)).not.toEqual([]);
    expect(dexWord(A.poolUsdcWeth3000, WETH.address, USDC.address)).not.toBe(SYC_ONEINCH_ROUTE.dex);
  });

  it("the entry points that were deliberately left out", () => {
    const left = [
      { to: A.oneInch, data: "0x07ed2379" + "00".repeat(64) }, // swap()
      { to: A.oneInch, data: "0xe2c95c82" + "00".repeat(160) }, // unoswapTo
      { to: A.router02, data: "0xac9650d8" + "00".repeat(64) }, // multicall
      { to: A.npm, data: "0x88316456" + "00".repeat(352) }, // mint
      { to: A.npm, data: "0x42966c68" + "00".repeat(32) }, // burn
      { to: WETH.address, data: IF.erc20.encodeFunctionData("approve", [STRANGER, 1n]) },
      { to: WETH.address, data: "0xa9059cbb" + coder.encode(["address", "uint256"], [STRANGER, 1n]).slice(2) }, // transfer
      { to: A.fund, data: "0xec68ac8d" + "00".repeat(64) },
      { to: A.roles, data: "0x957ed2b3" + "00".repeat(96) },
    ];
    for (const call of left) expect(sycValidate(call), call.data.slice(0, 10)).not.toEqual([]);
  });

  it("the buyback role may do nothing but the pinned buy", () => {
    expect(sycValidate(buildApprove(WETH, ONE_INCH_ROUTER_V6), "buyback")).not.toEqual([]);
    expect(sycValidate(buildSwap("uniswap", { route: sycRoutesBetween(SNI, WETH)[0], amountIn: 1n, minReturn: 1n }), "buyback")).not.toEqual([]);
    expect(sycValidate(buildCollect(1n), "buyback")).not.toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The buyback budget                                                          */
/* -------------------------------------------------------------------------- */

describe("the buyback budget, as Roles v2 accrues it", () => {
  const DAY = 86400n;
  const start = BigInt(stored.allowance.timestamp); // 2026-11-01 00:00 UTC
  const full: SycAllowance = {
    refill: SYC.BUYBACK_MAX,
    maxRefill: SYC.BUYBACK_MAX,
    period: DAY,
    balance: SYC.BUYBACK_MAX,
    timestamp: start,
  };

  it("a full budget stays full and points at the next midnight", () => {
    const now = start + 8n * DAY + 3600n;
    expect(accruedAllowance(full, now)).toEqual({ available: SYC.BUYBACK_MAX, nextRefill: start + 9n * DAY });
  });

  it("a spent day refills at the next midnight, and skipped days do not add up", () => {
    const spent = { ...full, balance: 0n, timestamp: start + 8n * DAY };
    expect(accruedAllowance(spent, start + 9n * DAY - 1n).available).toBe(0n);
    expect(accruedAllowance(spent, start + 9n * DAY).available).toBe(SYC.BUYBACK_MAX);
    expect(accruedAllowance(spent, start + 20n * DAY).available).toBe(SYC.BUYBACK_MAX);
  });

  it("a part-spent day keeps its remainder until midnight", () => {
    const part = { ...full, balance: ethers.parseEther("0.04"), timestamp: start + 8n * DAY };
    expect(accruedAllowance(part, start + 8n * DAY + 100n).available).toBe(ethers.parseEther("0.04"));
    expect(accruedAllowance(part, start + 9n * DAY).available).toBe(SYC.BUYBACK_MAX);
  });
});

/* -------------------------------------------------------------------------- */
/* Uniswap V3 arithmetic                                                       */
/* -------------------------------------------------------------------------- */

describe("Uniswap V3 arithmetic", () => {
  it("sqrtRatioAtTick matches TickMath at the ends and the middle", () => {
    expect(sqrtRatioAtTick(0)).toBe(1n << 96n);
    expect(sqrtRatioAtTick(-887272)).toBe(4295128739n);
    expect(sqrtRatioAtTick(887272)).toBe(1461446703485210103287273052203988822378723970342n);
  });

  it("reads the pools as people do: USDC per SNI and USDC per WETH", () => {
    // Ticks read off the live pools on 2026-11-09.
    expect(tickToPrice(288384, SNI_POOL)).toBeGreaterThan(0.29);
    expect(tickToPrice(288384, SNI_POOL)).toBeLessThan(0.32);
    const wethPool = SYC_POOLS.find((p) => p.fee === 500)!;
    expect(tickToPrice(199677, wethPool)).toBeGreaterThan(2000);
    expect(tickToPrice(199677, wethPool)).toBeLessThan(2300);
  });

  it("pairs one side of a deposit with the other and says which side an out-of-range one takes", () => {
    const tick = 288384;
    const sqrtP = sqrtRatioAtTick(tick);
    const lower = 288000;
    const upper = 288780;
    const amount0 = 1000n * 10n ** 6n;
    const amount1 = pairedAmount(sqrtP, lower, upper, { amount0 })!;
    expect(amount1).toBeGreaterThan(0n);
    const back = pairedAmount(sqrtP, lower, upper, { amount1 })!;
    expect(Number(back)).toBeCloseTo(Number(amount0), -3);
    expect(singleSide(sqrtP, lower, upper)).toBeNull();
    expect(singleSide(sqrtP, tick + 60, tick + 120)).toBe(0);
    expect(singleSide(sqrtP, tick - 120, tick - 60)).toBe(1);
    const liquidity = liquidityForAmount0(sqrtP, sqrtRatioAtTick(upper), amount0);
    const held = amountsForLiquidity(sqrtP, sqrtRatioAtTick(lower), sqrtRatioAtTick(upper), liquidity);
    expect(Number(held.amount0)).toBeCloseTo(Number(amount0), -3);
    expect(isFullRange(-887220, 887220, SNI_POOL)).toBe(true);
    expect(isFullRange(lower, upper, SNI_POOL)).toBe(false);
  });
});

describe("numbers and words", () => {
  it("floors and percentages", () => {
    expect(minReturnFor(1000n, 1)).toBe(990n);
    expect(lessPct(1000n, 0.5)).toBe(995n);
    expect(parsePct("1,5")).toBe(1.5);
    expect(parsePct("0")).toBeNull();
    expect(parsePct("51")).toBeNull();
    expect(parseAmount("0.5", 18)).toBe(SYC.BUYBACK_MAX);
    expect(parseAmount("abc", 18)).toBeNull();
  });

  it("explains the modifier's answers in the vault's terms", () => {
    expect(sycExplainDenial("The connected wallet does not hold the role this action needs on this vault.", "buyback")).toMatch(/not a Buyback-Executor/);
    expect(sycExplainDenial("The connected wallet does not hold the role this action needs on this vault.")).toMatch(/not an Executor/);
    expect(sycExplainDenial("The Roles modifier denied this call (status 17).")).toMatch(/budget is already spent/);
    expect(sycExplainDenial("The Roles modifier denied this call (status 9).")).toMatch(/at most 0.5 WETH/);
    expect(sycExplainDenial("The Roles modifier denied this call (status 16).")).toMatch(/not owned by the Safe/);
  });
});
