import { ethers } from "ethers";
import {
  ONE_INCH_ROUTER_V6,
  oneInchRouterInterface,
  type SwapAsset,
} from "./oneInchSwap";
import { ethCallOn, rpcRequestOn, type StateOverrides } from "./rpc";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Swaps built on chain, with no aggregator API.
 *
 * A vault's Roles whitelist scopes the 1inch router for `swap(executor, desc,
 * data)` and leaves the executor free. 1inch's own executors run a
 * proprietary routing program that only the 1inch API can write; the Rethink
 * swap executor (contracts/swap-executor) runs a route this module writes
 * instead: one exact-input trade on a named DEX router — Uniswap V3 or
 * Aerodrome Slipstream — whose output the 1inch router then measures against
 * `minReturnAmount` and delivers to the Safe. The whole trade is readable in
 * the calldata, and the router's floor is what protects the fill.
 *
 * Routes are found by asking the DEX factories for pools and priced by
 * simulating the identical `swap()` from the Safe, so every quote is the
 * router's own arithmetic against live pool state rather than an estimate.
 */

/**
 * The executor, pinned by CREATE2 through the deterministic deployment proxy
 * so it has the same address on every chain it is deployed to. The app
 * routes only when the code at the address hashes to the audited build.
 */
export const SWAP_EXECUTOR = {
  address: "0x2f732eF6E684f7f850281d5525933A0a1a931dC5",
  runtimeHash: "0x1e35d8cf9ecc741d2baf2e111973407b2895ffd452ae978050427ab2fcdd5261",
  deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  salt: "0x51a2d9df4f83e065beabcdfe74e21f5d5c0fe924c3b1a39fb6730df70647c1f2",
};

export type ExecutorState = "deployed" | "missing" | "foreign" | "unreachable";

/** Whether the audited executor sits at its address on this chain. */
export const readExecutorState = async (chainId: ChainId): Promise<ExecutorState> => {
  try {
    const code = await rpcRequestOn(chainId, "eth_getCode", [SWAP_EXECUTOR.address, "latest"]);
    if (typeof code !== "string" || code === "0x") return "missing";
    return ethers.keccak256(code) === SWAP_EXECUTOR.runtimeHash ? "deployed" : "foreign";
  } catch {
    return "unreachable";
  }
};

export interface DexVenue {
  key: string;
  name: string;
  factory: string;
  /** The periphery router the executor calls `exactInput` on. */
  router: string;
  /** Uniswap V3 pools are keyed by fee (uint24); Slipstream pools by tick spacing (int24). */
  tierKind: "fee" | "tickSpacing";
  tiers: number[];
  /** The original SwapRouter layout carries a deadline; SwapRouter02 does not. */
  deadline: boolean;
}

/** Base. Factories and routers verified against each other on chain. */
export const BASE_VENUES: DexVenue[] = [
  {
    key: "uniswap-v3",
    name: "Uniswap V3",
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    tierKind: "fee",
    tiers: [100, 500, 3000, 10000],
    deadline: false,
  },
  {
    key: "aerodrome-cl",
    name: "Aerodrome Slipstream",
    factory: "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
    router: "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5",
    tierKind: "tickSpacing",
    tiers: [1, 50, 100, 200, 2000],
    deadline: true,
  },
];

export interface RouteHop {
  tokenIn: SwapAsset;
  tokenOut: SwapAsset;
  tier: number;
  pool: string;
}

export interface OnchainRoute {
  venue: DexVenue;
  hops: RouteHop[];
  /** Human reading, e.g. "Aerodrome Slipstream · USDC → WETH (ts 100)". */
  label: string;
}

const IF = {
  factory: new ethers.Interface([
    "function getPool(address,address,uint24) view returns (address)",
    "function getPool(address,address,int24) view returns (address)",
  ]),
  uniswapRouter02: new ethers.Interface([
    "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  ]),
  slipstreamRouter: new ethers.Interface([
    "function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  ]),
};

export const tierLabel = (venue: DexVenue, tier: number) =>
  venue.tierKind === "fee" ? `${(tier / 10000).toFixed(2)}%` : `ts ${tier}`;

export const routeLabel = (venue: DexVenue, hops: RouteHop[]) =>
  `${venue.name} · ` +
  hops.reduce(
    (text, hop) => `${text} → ${hop.tokenOut.symbol} (${tierLabel(venue, hop.tier)})`,
    hops[0]?.tokenIn.symbol ?? "",
  );

const poolOf = async (
  chainId: ChainId,
  venue: DexVenue,
  a: SwapAsset,
  b: SwapAsset,
  tier: number,
): Promise<string | null> => {
  const fn =
    venue.tierKind === "fee"
      ? "getPool(address,address,uint24)"
      : "getPool(address,address,int24)";
  try {
    const hex = await ethCallOn(
      chainId,
      venue.factory,
      IF.factory.encodeFunctionData(fn, [a.address, b.address, tier]),
    );
    const [pool] = IF.factory.decodeFunctionResult(fn, hex);
    return pool === ethers.ZeroAddress ? null : (pool as string);
  } catch {
    return null;
  }
};

const poolsBetween = async (
  chainId: ChainId,
  venue: DexVenue,
  a: SwapAsset,
  b: SwapAsset,
): Promise<RouteHop[]> => {
  const hops = await Promise.all(
    venue.tiers.map(async (tier) => {
      const pool = await poolOf(chainId, venue, a, b, tier);
      return pool ? { tokenIn: a, tokenOut: b, tier, pool } : null;
    }),
  );
  return hops.filter((h): h is RouteHop => !!h);
};

/**
 * Every path from `src` to `dst` worth quoting: each venue's direct pools,
 * then two hops through an intermediate on the same venue (one `exactInput`
 * path). Two hops is the ceiling; on these assets a third never wins.
 */
export const discoverRoutes = async (
  chainId: ChainId,
  venues: DexVenue[],
  src: SwapAsset,
  dst: SwapAsset,
  hopTokens: SwapAsset[] = [],
): Promise<OnchainRoute[]> => {
  const mids = hopTokens.filter(
    (t) =>
      t.address.toLowerCase() !== src.address.toLowerCase() &&
      t.address.toLowerCase() !== dst.address.toLowerCase(),
  );
  const perVenue = await Promise.all(
    venues.map(async (venue) => {
      const routes: OnchainRoute[] = [];
      const direct = await poolsBetween(chainId, venue, src, dst);
      for (const hop of direct) routes.push({ venue, hops: [hop], label: routeLabel(venue, [hop]) });
      for (const mid of mids) {
        const [first, second] = await Promise.all([
          poolsBetween(chainId, venue, src, mid),
          poolsBetween(chainId, venue, mid, dst),
        ]);
        for (const a of first) {
          for (const b of second) {
            routes.push({ venue, hops: [a, b], label: routeLabel(venue, [a, b]) });
          }
        }
      }
      return routes;
    }),
  );
  return perVenue.flat();
};

/** The packed `exactInput` path: token, tier, token, tier, token… */
export const encodePath = (venue: DexVenue, hops: RouteHop[]): string => {
  const types: string[] = ["address"];
  const values: unknown[] = [hops[0].tokenIn.address];
  for (const hop of hops) {
    types.push(venue.tierKind === "fee" ? "uint24" : "int24", "address");
    values.push(hop.tier, hop.tokenOut.address);
  }
  return ethers.solidityPacked(types, values);
};

/** The router call the executor makes; its recipient is always the 1inch router. */
export const encodeVenueSwap = (
  venue: DexVenue,
  path: string,
  amountIn: bigint,
  amountOutMinimum: bigint,
  deadline: number,
): string =>
  venue.deadline
    ? IF.slipstreamRouter.encodeFunctionData("exactInput", [
      { path, recipient: ONE_INCH_ROUTER_V6, deadline, amountIn, amountOutMinimum },
    ])
    : IF.uniswapRouter02.encodeFunctionData("exactInput", [
      { path, recipient: ONE_INCH_ROUTER_V6, amountIn, amountOutMinimum },
    ]);

/**
 * What the executor reads from `swap()`'s data:
 * abi.encode(tokenIn, tokenOut, target, calldata). `tokenOut` is what the
 * executor measures on the 1inch router to report the output.
 */
export const encodeExecutorData = (
  tokenIn: string,
  tokenOut: string,
  target: string,
  targetCalldata: string,
) =>
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "bytes"],
    [tokenIn, tokenOut, target, targetCalldata],
  );

export const decodeExecutorData = (data: string) => {
  const [tokenIn, tokenOut, target, targetCalldata] =
    ethers.AbiCoder.defaultAbiCoder().decode(["address", "address", "address", "bytes"], data);
  return {
    tokenIn: tokenIn as string,
    tokenOut: tokenOut as string,
    target: target as string,
    targetCalldata: targetCalldata as string,
  };
};

export interface ExecutorSwapParams {
  safe: string;
  route: OnchainRoute;
  amountIn: bigint;
  /** Both the 1inch router's floor and the DEX router's `amountOutMinimum`. */
  minReturn: bigint;
  /** Unix seconds; only Slipstream's router reads it. */
  deadline: number;
}

export const routeEnds = (route: OnchainRoute) => ({
  src: route.hops[0].tokenIn,
  dst: route.hops[route.hops.length - 1].tokenOut,
});

/**
 * The router call: `swap(executor, desc, data)` with the sold token sent to
 * the executor, the proceeds pinned to the Safe, no flags, and the route in
 * `data` for the executor to run.
 */
export const buildExecutorSwap = ({
  safe,
  route,
  amountIn,
  minReturn,
  deadline,
}: ExecutorSwapParams): { to: string; data: string } => {
  const { src, dst } = routeEnds(route);
  const path = encodePath(route.venue, route.hops);
  const targetCalldata = encodeVenueSwap(route.venue, path, amountIn, minReturn, deadline);
  const data = encodeExecutorData(src.address, dst.address, route.venue.router, targetCalldata);
  return {
    to: ONE_INCH_ROUTER_V6,
    data: oneInchRouterInterface.encodeFunctionData("swap", [
      SWAP_EXECUTOR.address,
      {
        srcToken: src.address,
        dstToken: dst.address,
        srcReceiver: SWAP_EXECUTOR.address,
        dstReceiver: safe,
        amount: amountIn,
        minReturnAmount: minReturn,
        flags: 0n,
      },
      data,
    ]),
  };
};

/** Twenty minutes: long enough for a wallet prompt, short enough to go stale. */
export const swapDeadline = (now = Date.now()) => Math.floor(now / 1000) + 20 * 60;

/**
 * What a route would return right now, asked of the chain: the identical
 * `swap()` is eth_call'd from the Safe with a floor of 1, so the answer is
 * the router's own arithmetic against live pool state. A revert — no
 * liquidity, a path the pools cannot fill — comes back as null.
 */
export const quoteExecutorSwap = async (
  chainId: ChainId,
  safe: string,
  route: OnchainRoute,
  amountIn: bigint,
  overrides?: StateOverrides,
): Promise<bigint | null> => {
  const { to, data } = buildExecutorSwap({
    safe,
    route,
    amountIn,
    minReturn: 1n,
    deadline: swapDeadline(),
  });
  try {
    const hex = await ethCallOn(chainId, to, data, safe, overrides);
    const [returnAmount] = oneInchRouterInterface.decodeFunctionResult("swap", hex);
    return (returnAmount as bigint) > 0n ? (returnAmount as bigint) : null;
  } catch {
    return null;
  }
};

export interface RouteQuote {
  route: OnchainRoute;
  amountIn: bigint;
  amountOut: bigint;
}

/** Every candidate priced, best first. Candidates that cannot fill are dropped. */
export const quoteRoutes = async (
  chainId: ChainId,
  safe: string,
  routes: OnchainRoute[],
  amountIn: bigint,
  overrides?: StateOverrides,
): Promise<RouteQuote[]> => {
  const quotes = await Promise.all(
    routes.map(async (route) => {
      const amountOut = await quoteExecutorSwap(chainId, safe, route, amountIn, overrides);
      return amountOut ? { route, amountIn, amountOut } : null;
    }),
  );
  return quotes
    .filter((q): q is RouteQuote => !!q)
    .sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));
};

/** The floor to put on a quote, in base units of the bought asset. */
export const minReturnFor = (amountOut: bigint, tolerancePct: number) =>
  (amountOut * BigInt(Math.round((100 - tolerancePct) * 10000))) / 1000000n;
