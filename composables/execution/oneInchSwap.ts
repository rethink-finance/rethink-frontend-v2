import { ethers } from "ethers";
import type { OneInchProtocolLeg } from "~/services/backend/swap";

/**
 * The 1inch AggregationRouterV6 `swap()` entry point, as a vault's Roles
 * whitelist sees it.
 *
 * A vault that trades on 1inch is scoped for `swap(executor, desc, data)` and
 * nothing else on the router: `desc.dstReceiver` pinned to the Safe, and
 * `desc.dstToken` one-of the assets the vault may hold. The routing program
 * inside `data` is the pathfinder's — opaque, and never edited here. These
 * helpers read such calldata back and say, before anyone signs, whether the
 * modifier would take it and whether it does what the operator asked for.
 * Nothing here is vault-specific; each console supplies its own rules.
 */

/** AggregationRouterV6 — the same address on every chain 1inch deploys to. */
export const ONE_INCH_ROUTER_V6 = "0x111111125421cA6dc452d289314280a0f8842A65";
export const ONE_INCH_SWAP_SELECTOR = "0x07ed2379";

/** `desc.flags` bits, from the router's GenericRouter. */
export const ONE_INCH_FLAG_PARTIAL_FILL = 1n << 0n;
export const ONE_INCH_FLAG_REQUIRES_EXTRA_ETH = 1n << 1n;
export const ONE_INCH_FLAG_USE_PERMIT2 = 1n << 2n;

export const oneInchRouterInterface = new ethers.Interface([
  "function swap(address executor,(address srcToken,address dstToken,address srcReceiver,address dstReceiver,uint256 amount,uint256 minReturnAmount,uint256 flags) desc,bytes data) payable returns (uint256 returnAmount,uint256 spentAmount)",
]);

export interface OneInchSwapCalldata {
  executor: string;
  srcToken: string;
  dstToken: string;
  srcReceiver: string;
  dstReceiver: string;
  amount: bigint;
  minReturn: bigint;
  flags: bigint;
  /** The pathfinder's routing program — opaque, and never edited here. */
  program: string;
}

export interface SwapAsset {
  symbol: string;
  address: string;
  decimals: number;
}

/** What a leg is meant to do, for the calldata to be checked against. */
export interface OneInchSwapIntent {
  sell: SwapAsset;
  buy: SwapAsset;
  amount: bigint;
}

/** What the vault's modifier pins on `swap()`. */
export interface OneInchSwapRules {
  safe: string;
  /** The assets `desc.dstToken` may be. */
  permittedDst: SwapAsset[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const shortAddress = (a?: string) =>
  a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";

export const parseOneInchSwap = (hex: string): OneInchSwapCalldata => {
  const data = (hex ?? "").trim();
  if (!/^0x[0-9a-fA-F]*$/.test(data)) throw new Error("That is not hex calldata.");
  if (!data.toLowerCase().startsWith(ONE_INCH_SWAP_SELECTOR)) {
    throw new Error(
      `Wrong entry point: this calldata starts ${data.slice(0, 10)}, and the vault may only call swap (${ONE_INCH_SWAP_SELECTOR}). ` +
        "An unoswap or a permit2 variant will be refused by the modifier.",
    );
  }
  let decoded;
  try {
    decoded = oneInchRouterInterface.decodeFunctionData("swap", data);
  } catch {
    // Almost always a paste that lost its tail: the program is the longest
    // part of the calldata and the easiest thing to clip.
    throw new Error(
      "This calldata is the right entry point but does not decode — it looks truncated. Copy the whole of it, including the routing program at the end.",
    );
  }
  const [executor, desc, program] = decoded;
  return {
    executor,
    srcToken: desc.srcToken,
    dstToken: desc.dstToken,
    srcReceiver: desc.srcReceiver,
    dstReceiver: desc.dstReceiver,
    amount: desc.amount,
    minReturn: desc.minReturnAmount,
    flags: desc.flags,
    program,
  };
};

const fmt = (value: bigint, decimals: number) =>
  Number(ethers.formatUnits(value, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });

/**
 * Everything that would make the modifier reject this, or make it the wrong
 * trade, said before the wallet opens rather than as an opaque revert after
 * signing. The first three are the permission itself; the rest are the
 * difference between valid calldata and the calldata for THIS leg.
 *
 * `tolerance` is how far `desc.amount` may sit from the intended size. A
 * quote built here is exact; a pasted one was taken at a round number.
 */
export const validateOneInchSwap = (
  call: OneInchSwapCalldata,
  rules: OneInchSwapRules,
  intent: OneInchSwapIntent,
  tolerance = 0.02,
): string[] => {
  const problems: string[] = [];
  const nameOf = (address: string) =>
    rules.permittedDst.find((t) => same(t.address, address))?.symbol ??
    shortAddress(address);

  if (!rules.permittedDst.some((t) => same(t.address, call.dstToken))) {
    problems.push(
      `The modifier only allows buying ${rules.permittedDst.map((t) => t.symbol).join(", ")}, and this buys ${shortAddress(call.dstToken)}.`,
    );
  }
  if (!same(call.dstReceiver, rules.safe)) {
    problems.push(
      `Proceeds must land in the Safe. This sends them to ${shortAddress(call.dstReceiver)} — set the receiver to ${shortAddress(rules.safe)} when you build the swap.`,
    );
  }
  if (call.flags & ONE_INCH_FLAG_REQUIRES_EXTRA_ETH) {
    problems.push(
      "This swap expects ETH to be sent along with it, and the modifier allows no value on the router.",
    );
  }
  if (!same(call.srcToken, intent.sell.address)) {
    problems.push(
      `This leg sells ${intent.sell.symbol}, but the calldata sells ${nameOf(call.srcToken)}.`,
    );
  }
  if (!same(call.dstToken, intent.buy.address)) {
    problems.push(
      `This leg buys ${intent.buy.symbol}, but the calldata buys ${nameOf(call.dstToken)}.`,
    );
  }
  if (intent.amount > 0n) {
    const drift = Number((call.amount * 10000n) / intent.amount) / 10000 - 1;
    if (Math.abs(drift) > tolerance) {
      problems.push(
        `This leg sells ${fmt(intent.amount, intent.sell.decimals)} ${intent.sell.symbol}, ` +
          `but the calldata sells ${fmt(call.amount, intent.sell.decimals)} — ${(drift * 100).toFixed(1)}% off.`,
      );
    }
  }
  if (call.minReturn === 0n) {
    problems.push(
      "minReturn is zero, so this would accept any fill at all. Rebuild the swap with a slippage limit.",
    );
  }
  if (call.flags & ONE_INCH_FLAG_PARTIAL_FILL) {
    problems.push(
      "This calldata allows a partial fill, which could leave the trade half done. Rebuild it with partial fills off so it is all or nothing.",
    );
  }
  return problems;
};

/** "BASE_AERODROME_V3" → "Aerodrome V3"; "UNISWAP_V3" → "Uniswap V3". */
export const prettyProtocolName = (name: string) => {
  const parts = String(name ?? "")
    .split("_")
    .filter(Boolean);
  // The first token is the chain on every chain but Ethereum.
  const chainPrefixes = ["BASE", "POLYGON", "ARBITRUM", "OPTIMISM", "BSC", "AVALANCHE", "GNOSIS", "ZKSYNC", "LINEA", "FANTOM", "AURORA", "KLAYTN"];
  const words = chainPrefixes.includes(parts[0]) ? parts.slice(1) : parts;
  return words
    .map((w) => (/^V\d+$/i.test(w) ? w.toUpperCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
};

/**
 * The pathfinder's route as a line: hops joined by arrows, splits by plus
 * signs, each carrying its share. Empty when the response carried none.
 */
export const describeOneInchRoute = (
  protocols: OneInchProtocolLeg[][][] | undefined,
): string => {
  if (!Array.isArray(protocols) || !protocols.length) return "";
  const routes = protocols.map((hops) =>
    (hops ?? [])
      .map((splits) =>
        (splits ?? [])
          .map((leg) =>
            leg.part && leg.part < 100
              ? `${prettyProtocolName(leg.name)} ${Math.round(leg.part)}%`
              : prettyProtocolName(leg.name),
          )
          .join(" + "),
      )
      .filter(Boolean)
      .join(" → "),
  );
  return routes.filter(Boolean).join(" | ");
};

/**
 * What the trade gives up against oracle marks, in percent: negative means
 * value lost to fees, price impact and routing, positive means the pools
 * paid better than the oracle. Zero when a price is missing.
 */
export const swapImpactPct = (
  amountIn: bigint,
  sell: SwapAsset,
  sellPrice: number,
  amountOut: bigint,
  buy: SwapAsset,
  buyPrice: number,
): number => {
  const valueIn = Number(ethers.formatUnits(amountIn, sell.decimals)) * sellPrice;
  const valueOut = Number(ethers.formatUnits(amountOut, buy.decimals)) * buyPrice;
  if (!valueIn || !sellPrice || !buyPrice) return 0;
  return ((valueOut - valueIn) / valueIn) * 100;
};
