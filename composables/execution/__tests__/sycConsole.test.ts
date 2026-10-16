import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  IF,
  SYC,
  SYC_DEX_WORDS,
  SYC_LP_POOL,
  SYC_PATHS,
  SYC_POOLS,
  SYC_SELECTORS,
  SYC_SPENDERS,
  SYC_TOKENS,
  SYC_TWO_HOP_ROUTES,
  amountsForLiquidity,
  buildApprove,
  buildBurn,
  buildCollect,
  buildDecreaseLiquidity,
  buildMint,
  buildOneInchSwap,
  buildSwap,
  buildUniswapSwap,
  fullRange,
  lessPct,
  liquidityForAmounts,
  minReturnFor,
  pairedAmount,
  parseAmount,
  parsePct,
  priceToTick,
  rangeFromPrices,
  routePath,
  snapTick,
  sqrtRatioAtTick,
  sycExplainDenial,
  sycRouteBetween,
  sycToken,
  sycValidate,
  tickToPrice,
} from "../sycConsole";
import { parseUnoswap, wordHex } from "../onchainSwap";

const WETH = sycToken("WETH");
const USDC = sycToken("USDC");
const SNI = sycToken("SNI");
const A = SYC.ADDR;
const STRANGER = "0x000000000000000000000000000000000000bEEF";

/**
 * The condition pins exactly as syc-v2-permissions/scripts/build-perms.cjs
 * wrote them to the modifier (built.json, simulated 68/68 on the live
 * modifier at block 95,622,650). Every call this console builds has to pass
 * these, and every call it must not build has to fail them.
 */
const PINNED = {
  executorRoleKey: "0x64656661756c744d616e61676572526f6c650000000000000000000000000000",
  selectors: {
    approve: "0x095ea7b3",
    exactInputSingle: "0x04e45aaf",
    exactInput: "0xb858183f",
    unoswapTo: "0xe2c95c82",
    unoswapTo2: "0xea76dddf",
    mint: "0x88316456",
    decreaseLiquidity: "0x0c49ccbe",
    collect: "0xfc6f7865",
    burn: "0x42966c68",
  },
  dexWords: {
    WETH_TO_USDC: "0x200000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9",
    USDC_TO_WETH: "0x208000000000000000000000a4d8c89f0c20efbe54cba9e7e7a7e509056228d9",
    USDC_TO_SNI: "0x2080000000000000000000009ecb733a74b48ee31586c98986f0aa1ed5057c6a",
    SNI_TO_USDC: "0x2000000000000000000000009ecb733a74b48ee31586c98986f0aa1ed5057c6a",
  },
  paths: {
    WETH_TO_SNI:
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f6190001f43c499c542cef5e3811e1192ce70d8cc03d5c3359000bb8dc685acc53ca2a760029cab2f6a587482aa9cf57",
    SNI_TO_WETH:
      "0xdc685acc53ca2a760029cab2f6a587482aa9cf57000bb83c499c542cef5e3811e1192ce70d8cc03d5c33590001f47ceb23fd6bc0add59e62ac25578270cff1b9f619",
  },
  spenders: [
    "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    "0x111111125421cA6dc452d289314280a0f8842A65",
  ],
  safe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF",
  tokens: {
    SNI: "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57",
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
};

const lower = (s: string) => s.toLowerCase();

describe("the console's constants are the permission batch's", () => {
  it("names the executor key this factory created the role with", () => {
    expect(ethers.encodeBytes32String(SYC.ROLE)).toBe(PINNED.executorRoleKey);
  });

  it("uses the selectors the batch scoped", () => {
    expect(SYC_SELECTORS).toEqual(PINNED.selectors);
  });

  it("writes the four dex words the batch pinned", () => {
    for (const [k, hex] of Object.entries(PINNED.dexWords)) {
      expect(wordHex(SYC_DEX_WORDS[k as keyof typeof SYC_DEX_WORDS])).toBe(hex);
    }
  });

  it("writes the two exactInput paths the batch pinned", () => {
    expect(lower(SYC_PATHS.WETH_TO_SNI)).toBe(PINNED.paths.WETH_TO_SNI);
    expect(lower(SYC_PATHS.SNI_TO_WETH)).toBe(PINNED.paths.SNI_TO_WETH);
  });

  it("approves only to the three spenders, trades only the three tokens, keeps the Safe", () => {
    expect(SYC_SPENDERS.map(lower)).toEqual(PINNED.spenders.map(lower));
    expect(Object.fromEntries(SYC_TOKENS.map((t) => [t.symbol, lower(t.address)]))).toEqual(
      Object.fromEntries(Object.entries(PINNED.tokens).map(([k, v]) => [k, lower(v)])),
    );
    expect(lower(A.safe)).toBe(lower(PINNED.safe));
  });

  it("lists the pools with the pool's own token order and fee", () => {
    expect(SYC_POOLS.map((p) => [p.tokens[0].symbol, p.tokens[1].symbol, p.fee, p.tickSpacing])).toEqual([
      ["USDC", "WETH", 500, 10],
      ["USDC", "SNI", 3000, 60],
    ]);
    expect(SYC_LP_POOL.tokens.map((t) => t.symbol)).toEqual(["USDC", "SNI"]);
  });
});

describe("routes", () => {
  it("finds one route per pair: direct where a pool exists, through USDC for SNI and WETH", () => {
    const pairs: [typeof WETH, typeof WETH, number][] = [
      [WETH, USDC, 1],
      [USDC, WETH, 1],
      [USDC, SNI, 1],
      [SNI, USDC, 1],
      [WETH, SNI, 2],
      [SNI, WETH, 2],
    ];
    for (const [sell, buy, hops] of pairs) {
      const route = sycRouteBetween(sell, buy)!;
      expect(route.hops).toHaveLength(hops);
      expect(route.hops[0].sell.symbol).toBe(sell.symbol);
      expect(route.hops[route.hops.length - 1].buy.symbol).toBe(buy.symbol);
    }
    expect(sycRouteBetween(WETH, WETH)).toBeNull();
  });

  it("packs the two-hop route as the pinned path", () => {
    expect(lower(routePath(sycRouteBetween(WETH, SNI)!))).toBe(PINNED.paths.WETH_TO_SNI);
    expect(lower(routePath(sycRouteBetween(SNI, WETH)!))).toBe(PINNED.paths.SNI_TO_WETH);
  });
});

/** Every pair, both venues: what the console can build. */
const allSwaps = () => {
  const out: { venue: "oneInch" | "uniswap"; sell: typeof WETH; buy: typeof WETH; call: { to: string; data: string } }[] = [];
  for (const sell of SYC_TOKENS) {
    for (const buy of SYC_TOKENS) {
      if (sell === buy) continue;
      const route = sycRouteBetween(sell, buy)!;
      const amountIn = ethers.parseUnits("1", sell.decimals);
      for (const venue of ["oneInch", "uniswap"] as const) {
        out.push({ venue, sell, buy, call: buildSwap(venue, { route, amountIn, minReturn: 1n }) });
      }
    }
  }
  return out;
};

describe("swap calldata passes the pins", () => {
  it("builds twelve swaps and the validator accepts every one", () => {
    const swaps = allSwaps();
    expect(swaps).toHaveLength(12);
    for (const s of swaps) expect(sycValidate(s.call), `${s.venue} ${s.sell.symbol}→${s.buy.symbol}`).toEqual([]);
  });

  it("1inch single hops: to == Safe, token one-of, dex one-of the four words", () => {
    const route = sycRouteBetween(USDC, SNI)!;
    const { to, data } = buildOneInchSwap({ route, amountIn: 100_000_000n, minReturn: 5n });
    expect(to).toBe(A.oneInch);
    const call = parseUnoswap(data);
    expect(call.selector).toBe(PINNED.selectors.unoswapTo);
    expect(lower(call.to)).toBe(lower(PINNED.safe));
    expect(lower(call.token)).toBe(lower(PINNED.tokens.USDC));
    expect(call.amount).toBe(100_000_000n);
    expect(call.minReturn).toBe(5n);
    expect(wordHex(call.dex[0])).toBe(PINNED.dexWords.USDC_TO_SNI);
    // Each of the four directions writes exactly the pinned word.
    const expectWord = (sell: typeof WETH, buy: typeof WETH, key: keyof typeof PINNED.dexWords) => {
      const c = parseUnoswap(buildOneInchSwap({ route: sycRouteBetween(sell, buy)!, amountIn: 1n, minReturn: 1n }).data);
      expect(wordHex(c.dex[0])).toBe(PINNED.dexWords[key]);
    };
    expectWord(WETH, USDC, "WETH_TO_USDC");
    expectWord(USDC, WETH, "USDC_TO_WETH");
    expectWord(SNI, USDC, "SNI_TO_USDC");
  });

  it("1inch two hops: exactly the two pinned routes, word for word", () => {
    const wethToSni = parseUnoswap(buildOneInchSwap({ route: sycRouteBetween(WETH, SNI)!, amountIn: 1n, minReturn: 1n }).data);
    expect(wethToSni.selector).toBe(PINNED.selectors.unoswapTo2);
    expect(lower(wethToSni.to)).toBe(lower(PINNED.safe));
    expect(lower(wethToSni.token)).toBe(lower(PINNED.tokens.WETH));
    expect(wethToSni.dex.map(wordHex)).toEqual([PINNED.dexWords.WETH_TO_USDC, PINNED.dexWords.USDC_TO_SNI]);
    const sniToWeth = parseUnoswap(buildOneInchSwap({ route: sycRouteBetween(SNI, WETH)!, amountIn: 1n, minReturn: 1n }).data);
    expect(lower(sniToWeth.token)).toBe(lower(PINNED.tokens.SNI));
    expect(sniToWeth.dex.map(wordHex)).toEqual([PINNED.dexWords.SNI_TO_USDC, PINNED.dexWords.USDC_TO_WETH]);
    expect(SYC_TWO_HOP_ROUTES).toHaveLength(2);
  });

  it("Uniswap single hops: tokens one-of, recipient == Safe, the pool's fee", () => {
    const route = sycRouteBetween(WETH, USDC)!;
    const { to, data } = buildUniswapSwap({ route, amountIn: 10n ** 16n, minReturn: 24_000_000n });
    expect(to).toBe(A.router02);
    expect(data.slice(0, 10)).toBe(PINNED.selectors.exactInputSingle);
    const [p] = IF.router02.decodeFunctionData("exactInputSingle", data);
    expect(lower(p.tokenIn)).toBe(lower(PINNED.tokens.WETH));
    expect(lower(p.tokenOut)).toBe(lower(PINNED.tokens.USDC));
    expect(Number(p.fee)).toBe(500);
    expect(lower(p.recipient)).toBe(lower(PINNED.safe));
    expect(p.amountIn).toBe(10n ** 16n);
    expect(p.amountOutMinimum).toBe(24_000_000n);
    expect(p.sqrtPriceLimitX96).toBe(0n);
  });

  it("Uniswap two hops: the pinned path bytes, recipient == Safe", () => {
    const { data } = buildUniswapSwap({ route: sycRouteBetween(SNI, WETH)!, amountIn: 5n, minReturn: 1n });
    expect(data.slice(0, 10)).toBe(PINNED.selectors.exactInput);
    const [p] = IF.router02.decodeFunctionData("exactInput", data);
    expect(lower(p.path)).toBe(PINNED.paths.SNI_TO_WETH);
    expect(lower(p.recipient)).toBe(lower(PINNED.safe));
    expect(p.amountIn).toBe(5n);
  });

  it("approvals: the token's own contract, one of the three spenders, unlimited", () => {
    for (const token of SYC_TOKENS) {
      for (const spender of SYC_SPENDERS) {
        const call = buildApprove(token, spender);
        expect(call.to).toBe(token.address);
        expect(call.data.slice(0, 10)).toBe(PINNED.selectors.approve);
        const [s, amount] = IF.erc20.decodeFunctionData("approve", call.data);
        expect(lower(s)).toBe(lower(spender));
        expect(amount).toBe(ethers.MaxUint256);
        expect(sycValidate(call)).toEqual([]);
      }
    }
  });
});

describe("position calldata passes the pins", () => {
  const range = rangeFromPrices(0.2, 0.4);

  it("mint: USDC/SNI 0.3 %, recipient == Safe, the typed range and floors", () => {
    const call = buildMint({
      tickLower: range.tickLower,
      tickUpper: range.tickUpper,
      amount0Desired: 1_000_000_000n,
      amount1Desired: ethers.parseEther("3500"),
      amount0Min: 990_000_000n,
      amount1Min: ethers.parseEther("3465"),
      deadline: 1_900_000_000n,
    });
    expect(call.to).toBe(A.npm);
    expect(call.data.slice(0, 10)).toBe(PINNED.selectors.mint);
    const [p] = IF.npm.decodeFunctionData("mint", call.data);
    expect(lower(p.token0)).toBe(lower(PINNED.tokens.USDC));
    expect(lower(p.token1)).toBe(lower(PINNED.tokens.SNI));
    expect(Number(p.fee)).toBe(3000);
    expect(Number(p.tickLower)).toBe(range.tickLower);
    expect(Number(p.tickUpper)).toBe(range.tickUpper);
    expect(lower(p.recipient)).toBe(lower(PINNED.safe));
    expect(p.amount0Min).toBe(990_000_000n);
    expect(p.deadline).toBe(1_900_000_000n);
    expect(sycValidate(call)).toEqual([]);
  });

  it("decreaseLiquidity, collect(recipient == Safe) and burn", () => {
    const dec = buildDecreaseLiquidity({ tokenId: 2554538n, liquidity: 100n, amount0Min: 1n, amount1Min: 2n, deadline: 3n });
    expect(dec.data.slice(0, 10)).toBe(PINNED.selectors.decreaseLiquidity);
    expect(sycValidate(dec)).toEqual([]);
    const col = buildCollect(2554538n);
    expect(col.data.slice(0, 10)).toBe(PINNED.selectors.collect);
    const [c] = IF.npm.decodeFunctionData("collect", col.data);
    expect(lower(c.recipient)).toBe(lower(PINNED.safe));
    expect(c.amount0Max).toBe((1n << 128n) - 1n);
    expect(sycValidate(col)).toEqual([]);
    const burn = buildBurn(2554538n);
    expect(burn.data.slice(0, 10)).toBe(PINNED.selectors.burn);
    expect(sycValidate(burn)).toEqual([]);
  });
});

describe("the validator refuses what the modifier refuses", () => {
  const route = sycRouteBetween(USDC, SNI)!;

  it("a stranger as receiver, on every entry point", () => {
    const oneInch = buildOneInchSwap({ route, amountIn: 1n, minReturn: 1n });
    const tampered = {
      to: oneInch.to,
      data: oneInch.data.replace(lower(A.safe).slice(2), lower(STRANGER).slice(2)),
    };
    expect(sycValidate(tampered)[0]).toMatch(/Safe/);
    const uni = buildUniswapSwap({ route, amountIn: 1n, minReturn: 1n });
    const [p] = IF.router02.decodeFunctionData("exactInputSingle", uni.data);
    const bad = IF.router02.encodeFunctionData("exactInputSingle", [{ ...p.toObject(), recipient: STRANGER }]);
    expect(sycValidate({ to: A.router02, data: bad })[0]).toMatch(/Safe/);
    const col = buildCollect(1n);
    expect(sycValidate({ to: A.npm, data: col.data.replace(lower(A.safe).slice(2), lower(STRANGER).slice(2)) })[0]).toMatch(/Safe/);
  });

  it("a pool, route or path that is not listed", () => {
    const foreignPool = "0x45dDa9cb7c25131DF268515131f647d726f50608"; // USDC.e/WETH 0.05 %
    const data = ethers.concat([
      PINNED.selectors.unoswapTo,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256"],
        [BigInt(A.safe), BigInt(USDC.address), 1n, 1n, (1n << 253n) | (1n << 247n) | BigInt(foreignPool)],
      ),
    ]);
    expect(sycValidate({ to: A.oneInch, data })[0]).toMatch(/not one of the two listed/);
    // The round trip USDC → WETH → USDC is two listed words, but not a pinned route.
    const roundTrip = ethers.concat([
      PINNED.selectors.unoswapTo2,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        [BigInt(A.safe), BigInt(USDC.address), 1n, 1n, SYC_DEX_WORDS.USDC_TO_WETH, SYC_DEX_WORDS.WETH_TO_USDC],
      ),
    ]);
    expect(sycValidate({ to: A.oneInch, data: roundTrip })[0]).toMatch(/exactly WETH → USDC → SNI/);
    // A single-hop path through exactInput is not one of the two pinned paths.
    const single = ethers.solidityPacked(["address", "uint24", "address"], [USDC.address, 3000, SNI.address]);
    const bad = IF.router02.encodeFunctionData("exactInput", [{ path: single, recipient: A.safe, amountIn: 1n, amountOutMinimum: 1n }]);
    expect(sycValidate({ to: A.router02, data: bad })[0]).toMatch(/exactly WETH → USDC → SNI/);
  });

  it("the entry points that were deliberately left out", () => {
    const swap = "0x07ed2379" + "00".repeat(64);
    expect(sycValidate({ to: A.oneInch, data: swap })[0]).toMatch(/swap\(\) is not/);
    const multicall = new ethers.Interface(["function multicall(bytes[] data)"]).encodeFunctionData("multicall", [["0x"]]);
    expect(sycValidate({ to: A.router02, data: multicall })[0]).toMatch(/multicall is not/);
    expect(sycValidate({ to: A.npm, data: multicall })[0]).toMatch(/not granted/);
    const increase = new ethers.Interface([
      "function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline))",
    ]).encodeFunctionData("increaseLiquidity", [{ tokenId: 1n, amount0Desired: 1n, amount1Desired: 1n, amount0Min: 0n, amount1Min: 0n, deadline: 1n }]);
    expect(sycValidate({ to: A.npm, data: increase })[0]).toMatch(/increaseLiquidity/);
    const transfer = new ethers.Interface(["function transfer(address,uint256)"]).encodeFunctionData("transfer", [STRANGER, 1n]);
    expect(sycValidate({ to: SNI.address, data: transfer })[0]).toMatch(/only be approved/);
    expect(sycValidate({ to: STRANGER, data: buildCollect(1n).data })[0]).toMatch(/not a target/);
  });

  it("an approval to anyone but the three spenders, or a mint in another pool", () => {
    const bad = { to: WETH.address, data: IF.erc20.encodeFunctionData("approve", [STRANGER, 1n]) };
    expect(sycValidate(bad)[0]).toMatch(/may only be approved to/);
    const [m] = IF.npm.decodeFunctionData(
      "mint",
      buildMint({ tickLower: -60, tickUpper: 60, amount0Desired: 1n, amount1Desired: 1n, amount0Min: 0n, amount1Min: 0n, deadline: 1n }).data,
    );
    const wrongFee = IF.npm.encodeFunctionData("mint", [{ ...m.toObject(), fee: 500 }]);
    expect(sycValidate({ to: A.npm, data: wrongFee })[0]).toMatch(/USDC\/SNI 0.3%/);
    const wrongPair = IF.npm.encodeFunctionData("mint", [{ ...m.toObject(), token1: WETH.address }]);
    expect(sycValidate({ to: A.npm, data: wrongPair })[0]).toMatch(/USDC\/SNI 0.3%/);
  });
});

describe("Uniswap V3 arithmetic", () => {
  it("sqrtRatioAtTick matches TickMath at the ends and the middle", () => {
    expect(sqrtRatioAtTick(0)).toBe(1n << 96n);
    expect(sqrtRatioAtTick(-887272)).toBe(4295128739n);
    expect(sqrtRatioAtTick(887272)).toBe(1461446703485210103287273052203988822378723970342n);
    // The live USDC/SNI tick on 2026-10-16, with the pool's own sqrtPriceX96 a hair above it.
    const live = 149481529192705993027928345807134697n;
    expect(sqrtRatioAtTick(289021) <= live && live < sqrtRatioAtTick(289022)).toBe(true);
  });

  it("prices the USDC/SNI pool as USDC per SNI and back", () => {
    const price = tickToPrice(289021);
    expect(price).toBeGreaterThan(0.28);
    expect(price).toBeLessThan(0.285);
    expect(Math.round(priceToTick(price))).toBe(289021);
    // Full range reads as 0 to infinity.
    expect(tickToPrice(fullRange().tickUpper)).toBeLessThan(1e-20);
    expect(tickToPrice(fullRange().tickLower)).toBeGreaterThan(1e20);
  });

  it("snaps a price range outward to the 60-tick spacing, min price on the upper tick", () => {
    const { tickLower, tickUpper } = rangeFromPrices(0.2, 0.4);
    expect(tickLower % 60).toBe(0);
    expect(tickUpper % 60).toBe(0);
    expect(tickLower).toBeLessThan(tickUpper);
    expect(tickToPrice(tickUpper)).toBeLessThanOrEqual(0.2);
    expect(tickToPrice(tickLower)).toBeGreaterThanOrEqual(0.4);
    expect(snapTick(123, 60, "down")).toBe(120);
    expect(snapTick(123, 60, "up")).toBe(180);
    expect(snapTick(-123, 60, "down")).toBe(-180);
    expect(fullRange()).toEqual({ tickLower: -887220, tickUpper: 887220 });
    expect(() => rangeFromPrices(0.4, 0.2)).toThrow(/max price/);
  });

  it("values the v1 Safe's full-range position close to its collectable pair", () => {
    // Position #2554538 on 2026-10-16: liquidity 346,058,960,032, full range, pool tick 289021.
    const sqrtP = 149481529192705993027928345807134697n;
    const { amount0, amount1 } = amountsForLiquidity(sqrtP, sqrtRatioAtTick(-887220), sqrtRatioAtTick(887220), 346058960032n);
    // A full-range position holds value split evenly: amount0 (USDC) ≈ amount1 (SNI) × price.
    const usdc = Number(ethers.formatUnits(amount0, 6));
    const sni = Number(ethers.formatUnits(amount1, 18));
    expect(usdc).toBeGreaterThan(0);
    expect(Math.abs(usdc - sni * tickToPrice(289021)) / usdc).toBeLessThan(0.001);
  });

  it("pairs one side of a new in-range position with the other, and round-trips liquidity", () => {
    const sqrtP = sqrtRatioAtTick(289021);
    const { tickLower, tickUpper } = rangeFromPrices(0.2, 0.4);
    const amount0 = 1_000_000_000n; // 1,000 USDC
    const amount1 = pairedAmount(sqrtP, tickLower, tickUpper, { amount0 })!;
    expect(amount1).toBeGreaterThan(0n);
    const back = pairedAmount(sqrtP, tickLower, tickUpper, { amount1 })!;
    expect(Number(back - amount0)).toBeLessThanOrEqual(1);
    const liquidity = liquidityForAmounts(sqrtP, sqrtRatioAtTick(tickLower), sqrtRatioAtTick(tickUpper), amount0, amount1);
    const got = amountsForLiquidity(sqrtP, sqrtRatioAtTick(tickLower), sqrtRatioAtTick(tickUpper), liquidity);
    expect(Number(amount0 - got.amount0)).toBeLessThanOrEqual(1);
    expect(Number(amount1 - got.amount1) / Number(amount1)).toBeLessThan(1e-12);
    // Out of range on the USDC side: only SNI goes in, nothing pairs.
    expect(pairedAmount(sqrtP, 289080, 289200, { amount0 })).toBeNull();
  });
});

describe("numbers and words", () => {
  it("floors and percentages", () => {
    expect(minReturnFor(1_000_000n, 1)).toBe(990_000n);
    expect(lessPct(1_000_000n, 0.5)).toBe(995_000n);
    expect(parseAmount("1.5", 6)).toBe(1_500_000n);
    expect(parseAmount("0", 6)).toBeNull();
    expect(parseAmount("abc", 6)).toBeNull();
    expect(parseAmount("1,5", 18)).toBe(ethers.parseEther("1.5"));
    expect(parsePct("1")).toBe(1);
    expect(parsePct("51")).toBeNull();
    expect(parsePct("")).toBeNull();
  });

  it("explains the modifier's answers in the vault's terms", () => {
    expect(sycExplainDenial("The call reverted (0x4a0bfec1).")).toMatch(/not an executor/);
    expect(sycExplainDenial("The connected wallet does not hold the role this action needs on this vault.")).toMatch(/not an executor/);
    expect(sycExplainDenial("The Roles modifier denied this call (status 5).")).toMatch(/not one of the two/);
    expect(sycExplainDenial("This target address is not allowed for your role.")).toMatch(/no grant for this contract/);
    expect(sycExplainDenial("A parameter does not match the value pinned by the permission.")).toMatch(/pinned/);
  });
});
