import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  BASE_VENUES,
  SWAP_EXECUTOR,
  buildExecutorSwap,
  decodeExecutorData,
  encodeExecutorData,
  encodePath,
  encodeVenueSwap,
  minReturnFor,
  routeEnds,
  routeLabel,
  swapDeadline,
  type OnchainRoute,
} from "../onchainSwap";
import { ONE_INCH_ROUTER_V6, parseOneInchSwap, validateOneInchSwap } from "../oneInchSwap";
import { INDEFI, INDEFI_SWAP_RULES, INDEFI_TOKENS } from "../indefiConsole";

const token = (symbol: string) => INDEFI_TOKENS.find((t) => t.symbol === symbol)!;
const uniswap = BASE_VENUES.find((v) => v.key === "uniswap-v3")!;
const aerodrome = BASE_VENUES.find((v) => v.key === "aerodrome-cl")!;

const uniRoute: OnchainRoute = {
  venue: uniswap,
  hops: [{ tokenIn: token("USDC"), tokenOut: token("WETH"), tier: 500, pool: "0xd0b53D9277642d899DF5C87A3966A349A798F224" }],
  label: "",
};
const aeroRoute: OnchainRoute = {
  venue: aerodrome,
  hops: [{ tokenIn: token("USDC"), tokenOut: token("WETH"), tier: 100, pool: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59" }],
  label: "",
};

describe("path encoding", () => {
  it("packs token, tier, token the way exactInput reads it", () => {
    const usdc = token("USDC").address.slice(2).toLowerCase();
    const weth = token("WETH").address.slice(2).toLowerCase();
    // Uniswap: uint24 fee 500 = 0x0001f4
    expect(encodePath(uniswap, uniRoute.hops)).toBe(`0x${usdc}0001f4${weth}`);
    // Slipstream: int24 tick spacing 100 = 0x000064
    expect(encodePath(aerodrome, aeroRoute.hops)).toBe(`0x${usdc}000064${weth}`);
  });

  it("chains two hops into one path", () => {
    const aero = token("AERO").address.slice(2).toLowerCase();
    const hops = [
      uniRoute.hops[0],
      { tokenIn: token("WETH"), tokenOut: token("AERO"), tier: 3000, pool: "0x0000000000000000000000000000000000000001" },
    ];
    expect(encodePath(uniswap, hops)).toMatch(new RegExp(`0001f4.{40}000bb8${aero}$`));
    expect(routeLabel(uniswap, hops)).toBe("Uniswap V3 · USDC → WETH (0.05%) → AERO (0.30%)");
    expect(routeLabel(aerodrome, aeroRoute.hops)).toBe("Aerodrome Slipstream · USDC → WETH (ts 100)");
  });
});

describe("venue calls", () => {
  const path = encodePath(uniswap, uniRoute.hops);

  it("targets the DEX router's exactInput with the 1inch router as recipient", () => {
    const uni = new ethers.Interface([
      "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params)",
    ]);
    const [params] = uni.decodeFunctionData("exactInput", encodeVenueSwap(uniswap, path, 1000n, 7n, 123));
    expect(params.path).toBe(path);
    expect(params.recipient).toBe(ONE_INCH_ROUTER_V6);
    expect(params.amountIn).toBe(1000n);
    expect(params.amountOutMinimum).toBe(7n);

    const slip = new ethers.Interface([
      "function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum) params)",
    ]);
    const [p2] = slip.decodeFunctionData("exactInput", encodeVenueSwap(aerodrome, path, 1000n, 7n, 123));
    expect(p2.deadline).toBe(123n);
    expect(p2.recipient).toBe(ONE_INCH_ROUTER_V6);
  });

  it("round-trips the executor's route blob", () => {
    const blob = encodeExecutorData(token("USDC").address, token("WETH").address, uniswap.router, "0xdeadbeef");
    expect(decodeExecutorData(blob)).toEqual({
      tokenIn: token("USDC").address,
      tokenOut: token("WETH").address,
      target: uniswap.router,
      targetCalldata: "0xdeadbeef",
    });
  });
});

describe("buildExecutorSwap", () => {
  const amountIn = ethers.parseUnits("1000", 6);
  const minReturn = ethers.parseUnits("0.37", 18);
  const { to, data } = buildExecutorSwap({
    safe: INDEFI.ADDR.safe,
    route: uniRoute,
    amountIn,
    minReturn,
    deadline: swapDeadline(1_800_000_000_000),
  });

  it("is a swap() on the v6 router that the INDEFI whitelist accepts", () => {
    expect(to).toBe(ONE_INCH_ROUTER_V6);
    const call = parseOneInchSwap(data);
    expect(call.executor).toBe(SWAP_EXECUTOR.address);
    expect(call.srcReceiver).toBe(SWAP_EXECUTOR.address);
    expect(call.dstReceiver).toBe(INDEFI.ADDR.safe);
    expect(call.srcToken).toBe(token("USDC").address);
    expect(call.dstToken).toBe(token("WETH").address);
    expect(call.amount).toBe(amountIn);
    expect(call.minReturn).toBe(minReturn);
    expect(call.flags).toBe(0n);
    expect(
      validateOneInchSwap(call, INDEFI_SWAP_RULES, { sell: token("USDC"), buy: token("WETH"), amount: amountIn }, 0),
    ).toEqual([]);
  });

  it("carries the route for the executor in the program bytes", () => {
    const call = parseOneInchSwap(data);
    const route = decodeExecutorData(call.program);
    expect(route.tokenIn).toBe(token("USDC").address);
    expect(route.tokenOut).toBe(token("WETH").address);
    expect(route.target).toBe(uniswap.router);
    expect(route.targetCalldata.startsWith("0xb858183f")).toBe(true); // exactInput((bytes,address,uint256,uint256))
    expect(routeEnds(uniRoute)).toEqual({ src: token("USDC"), dst: token("WETH") });
  });
});

describe("numbers", () => {
  it("applies the tolerance to the floor and dates the deadline", () => {
    expect(minReturnFor(1_000_000n, 1)).toBe(990_000n);
    expect(minReturnFor(1_000_000n, 0.5)).toBe(995_000n);
    expect(swapDeadline(1_800_000_000_000)).toBe(1_800_000_000 + 1200);
  });

  it("pins the executor by its audited build", () => {
    expect(ethers.isAddress(SWAP_EXECUTOR.address)).toBe(true);
    expect(SWAP_EXECUTOR.salt).toBe(ethers.keccak256(ethers.toUtf8Bytes("rethink.finance/RethinkSwapExecutor/v1")));
    expect(SWAP_EXECUTOR.runtimeHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
