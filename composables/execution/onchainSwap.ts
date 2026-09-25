import { ethers } from "ethers";
import { ONE_INCH_ROUTER_V6, shortAddress, type SwapAsset } from "./oneInchSwap";
import { ethCallOn, type StateOverrides } from "./rpc";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Swaps built on chain, with no aggregator API and no contract of ours.
 *
 * The 1inch router's `unoswapTo` family takes the pool to trade through as a
 * plain number — the "dex word": a protocol tag in the top bits, a direction
 * flag, and the pool address in the low 160 — and sends the output straight
 * to `to`. So a route is written here from a fixed list of pools, priced by
 * simulating the identical call from the Safe (the router's own arithmetic
 * against live pool state, not an estimate) and sent through the vault's
 * Roles modifier like any other curator call.
 *
 * The same list of pools is what the modifier is scoped to: `to` pinned to
 * the Safe, the sold token one-of the vault's assets, `dex` (and `dex2`)
 * one-of exactly these words. A compromised manager key therefore cannot
 * route the vault's money through a pool of its own, cannot send the
 * proceeds anywhere but the Safe, and cannot reach any other entry point.
 * What the whitelist cannot bound is the price accepted (`minReturn`), which
 * no Roles v1 condition can relate to the amount — the console fills it from
 * a live quote and the operator's tolerance.
 */

/** ProtocolLib in AggregationRouterV6: protocol 1 = Uniswap V3 forks. */
export const UNISWAP_V3_PROTOCOL_FLAG = 1n << 253n;
/** Set when the sold token is the pool's token0 (tokens sort by address). */
export const ZERO_FOR_ONE_FLAG = 1n << 247n;
/** Other flag bits the router understands; none of them belongs in a listed word. */
export const WETH_UNWRAP_FLAG = 1n << 252n;

export const unoswapInterface = new ethers.Interface([
  "function unoswapTo(uint256 to,uint256 token,uint256 amount,uint256 minReturn,uint256 dex) returns (uint256 returnAmount)",
  "function unoswapTo2(uint256 to,uint256 token,uint256 amount,uint256 minReturn,uint256 dex,uint256 dex2) returns (uint256 returnAmount)",
]);
export const UNOSWAP_TO_SELECTOR = unoswapInterface.getFunction("unoswapTo")!.selector;
export const UNOSWAP_TO2_SELECTOR = unoswapInterface.getFunction("unoswapTo2")!.selector;

/** A pool the vault may trade through, as the whitelist and the console both know it. */
export interface AllowedPool {
  address: string;
  tokens: [SwapAsset, SwapAsset];
  /** Human reading, e.g. "Uniswap V3 USDC/WETH 0.05%". */
  label: string;
}

export interface UnoswapHop {
  pool: AllowedPool;
  sell: SwapAsset;
  buy: SwapAsset;
  /** The dex word for this pool in this direction. */
  word: bigint;
}

export interface UnoswapRoute {
  hops: UnoswapHop[];
  /** e.g. "USDC → WETH · Uniswap V3 USDC/WETH 0.05%". */
  label: string;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The word `unoswapTo` reads a pool from. Uniswap V3 orders a pool's tokens
 * by address, so the direction follows from comparing the two and nothing
 * has to be read on chain.
 */
export const dexWord = (pool: string, sellToken: string, buyToken: string): bigint =>
  UNISWAP_V3_PROTOCOL_FLAG |
  (sellToken.toLowerCase() < buyToken.toLowerCase() ? ZERO_FOR_ONE_FLAG : 0n) |
  BigInt(pool);

/** A uint256 as the 32-byte value a Roles compValue holds. */
export const wordHex = (value: bigint | string) =>
  ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);

/** Both directions of every listed pool: the exact set the modifier allows. */
export const allowedDexWords = (pools: AllowedPool[]): bigint[] =>
  pools.flatMap((pool) => [
    dexWord(pool.address, pool.tokens[0].address, pool.tokens[1].address),
    dexWord(pool.address, pool.tokens[1].address, pool.tokens[0].address),
  ]);

const hopThrough = (pool: AllowedPool, sell: SwapAsset): UnoswapHop | null => {
  const [a, b] = pool.tokens;
  const buy = same(a.address, sell.address) ? b : same(b.address, sell.address) ? a : null;
  if (!buy) return null;
  return { pool, sell, buy, word: dexWord(pool.address, sell.address, buy.address) };
};

const routeLabel = (hops: UnoswapHop[]) =>
  `${hops[0].sell.symbol}${hops.map((h) => ` → ${h.buy.symbol}`).join("")} · ${hops.map((h) => h.pool.label).join(" → ")}`;

/**
 * Every path from `src` to `dst` inside the list: the direct pools, then two
 * hops through any token both legs have a listed pool for. Two is the
 * ceiling, because `unoswapTo2` is the widest entry point whitelisted.
 */
export const routesBetween = (pools: AllowedPool[], src: SwapAsset, dst: SwapAsset): UnoswapRoute[] => {
  const routes: UnoswapRoute[] = [];
  const firstLegs = pools.map((p) => hopThrough(p, src)).filter((h): h is UnoswapHop => !!h);
  for (const hop of firstLegs) {
    if (same(hop.buy.address, dst.address)) routes.push({ hops: [hop], label: routeLabel([hop]) });
  }
  for (const first of firstLegs) {
    if (same(first.buy.address, dst.address) || same(first.buy.address, src.address)) continue;
    for (const pool of pools) {
      if (pool.address.toLowerCase() === first.pool.address.toLowerCase()) continue;
      const second = hopThrough(pool, first.buy);
      if (second && same(second.buy.address, dst.address)) {
        routes.push({ hops: [first, second], label: routeLabel([first, second]) });
      }
    }
  }
  return routes;
};

export const routeEnds = (route: UnoswapRoute) => ({
  src: route.hops[0].sell,
  dst: route.hops[route.hops.length - 1].buy,
});

export interface UnoswapParams {
  safe: string;
  route: UnoswapRoute;
  amountIn: bigint;
  minReturn: bigint;
}

/** The router call: proceeds to the Safe, the route as one or two dex words. */
export const buildUnoswap = ({ safe, route, amountIn, minReturn }: UnoswapParams): { to: string; data: string } => {
  const { src } = routeEnds(route);
  const head = [BigInt(safe), BigInt(src.address), amountIn, minReturn];
  const words = route.hops.map((h) => h.word);
  const data =
    words.length === 1
      ? unoswapInterface.encodeFunctionData("unoswapTo", [...head, words[0]])
      : unoswapInterface.encodeFunctionData("unoswapTo2", [...head, words[0], words[1]]);
  return { to: ONE_INCH_ROUTER_V6, data };
};

export interface UnoswapCalldata {
  selector: string;
  to: string;
  token: string;
  amount: bigint;
  minReturn: bigint;
  dex: bigint[];
}

/** Read an unoswapTo / unoswapTo2 call back, the way the modifier sees it. */
export const parseUnoswap = (hex: string): UnoswapCalldata => {
  const data = (hex ?? "").trim();
  if (!/^0x[0-9a-fA-F]*$/.test(data)) throw new Error("That is not hex calldata.");
  const selector = data.slice(0, 10).toLowerCase();
  const name =
    selector === UNOSWAP_TO_SELECTOR ? "unoswapTo" : selector === UNOSWAP_TO2_SELECTOR ? "unoswapTo2" : null;
  if (!name) throw new Error(`Not an unoswapTo call: selector ${selector}.`);
  const args = unoswapInterface.decodeFunctionData(name, data);
  const asAddress = (v: bigint) => ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(v), 20));
  return {
    selector,
    to: asAddress(args[0]),
    token: asAddress(args[1]),
    amount: args[2],
    minReturn: args[3],
    dex: name === "unoswapTo" ? [args[4]] : [args[4], args[5]],
  };
};

/** What the modifier pins, in the same terms the proposal scopes them. */
export interface UnoswapRules {
  safe: string;
  /** Tokens that may be sold (`token` one-of). */
  sellable: SwapAsset[];
  /** Pool words that may be traded through (`dex` / `dex2` one-of). */
  dexWords: bigint[];
}

/**
 * Everything the modifier would refuse, said before the wallet opens, plus
 * whether the call is the trade the operator asked for.
 */
export const validateUnoswap = (
  call: UnoswapCalldata,
  rules: UnoswapRules,
  intent: { sell: SwapAsset; buy: SwapAsset; amount: bigint },
): string[] => {
  const problems: string[] = [];
  if (!same(call.to, rules.safe)) {
    problems.push(`Proceeds must land in the Safe, not ${shortAddress(call.to)}.`);
  }
  if (!rules.sellable.some((t) => same(t.address, call.token))) {
    problems.push(`The whitelist does not allow selling ${shortAddress(call.token)}.`);
  }
  for (const word of call.dex) {
    if (!rules.dexWords.includes(word)) {
      problems.push(`Pool ${shortAddress(ethers.zeroPadValue(ethers.toBeHex(word & ((1n << 160n) - 1n)), 20))} is not on the whitelist in this direction.`);
    }
  }
  if (!same(call.token, intent.sell.address)) {
    problems.push(`This sells ${shortAddress(call.token)}, not ${intent.sell.symbol}.`);
  }
  if (call.amount !== intent.amount) {
    problems.push("The amount in the calldata is not the amount entered.");
  }
  if (call.minReturn === 0n) {
    problems.push("minReturn is zero, so this would accept any fill at all.");
  }
  return problems;
};

/**
 * What a route would return right now, asked of the chain: the identical
 * call is eth_call'd from the Safe with a floor of 1, so the answer is the
 * router's own arithmetic against live pool state. eth_call from the Safe
 * does not go through the modifier, so this prices routes before the
 * whitelist allows them too. A revert comes back as null.
 */
export const quoteUnoswap = async (
  chainId: ChainId,
  safe: string,
  route: UnoswapRoute,
  amountIn: bigint,
  overrides?: StateOverrides,
): Promise<bigint | null> => {
  const { to, data } = buildUnoswap({ safe, route, amountIn, minReturn: 1n });
  try {
    const hex = await ethCallOn(chainId, to, data, safe, overrides);
    const [returnAmount] = unoswapInterface.decodeFunctionResult(
      route.hops.length === 1 ? "unoswapTo" : "unoswapTo2",
      hex,
    );
    return (returnAmount as bigint) > 0n ? (returnAmount as bigint) : null;
  } catch {
    return null;
  }
};

export interface RouteQuote {
  route: UnoswapRoute;
  amountIn: bigint;
  amountOut: bigint;
}

/** Every candidate priced, best first. Candidates that cannot fill are dropped. */
export const quoteRoutes = async (
  chainId: ChainId,
  safe: string,
  routes: UnoswapRoute[],
  amountIn: bigint,
  overrides?: StateOverrides,
): Promise<RouteQuote[]> => {
  const quotes = await Promise.all(
    routes.map(async (route) => {
      const amountOut = await quoteUnoswap(chainId, safe, route, amountIn, overrides);
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
