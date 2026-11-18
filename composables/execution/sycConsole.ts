import { ethers } from "ethers";
import {
  UNOSWAP_TO2_SELECTOR,
  buildUnoswap,
  dexWord,
  parseUnoswap,
  routesBetween,
  type AllowedPool,
  type UnoswapRoute,
} from "./onchainSwap";
import { ONE_INCH_ROUTER_V6, shortAddress, type SwapAsset } from "./oneInchSwap";
import { ethCallOn } from "./rpc";
import { ChainId } from "~/types/enums/chain_id";

/**
 * SNI Yield Claim Vault (SYC, Polygon) execution console: addresses, the
 * grants as the console knows them, calldata builders, the Uniswap V3
 * arithmetic the positions card needs, reads and quotes.
 *
 * The vault runs Zodiac Roles v2 with three roles. Besides the app's own
 * switches (NAV, flows, fees, members), what is stored on the modifier
 * (tx 0x543a5311…, 2026-11-09, fork-tested in scripts/sni-roles-v2) is:
 *
 * Executor (`defaultManagerRole`, the key the V1.5 factory assigns)
 *   WETH, SNI, USDC     approve(spender one-of SwapRouter02, Uniswap NPM, 1inch)
 *   SwapRouter02        exactInputSingle / exactOutputSingle(tokenIn and
 *                         tokenOut one-of the three, any fee, recipient == Safe)
 *                       exactInput / exactOutput(path one-of eight: SNI ⇄
 *                         USDC 0.3% ⇄ WETH at 0.01/0.05/0.3/1%, recipient == Safe)
 *   1inch v6            unoswapTo2(to == Safe, token == WETH, dex == WETH→USDC
 *                         0.05%, dex2 == USDC→SNI 0.3%) — the pinned buy route
 *   Uniswap NPM         increaseLiquidity, decreaseLiquidity(tokenId owned by
 *                         the Safe), collect(owned, recipient == Safe)
 *
 * Buyback-Executor (`Buyback-Executor`)
 *   1inch v6            the same unoswapTo2, amount ≤ 0.1 WETH and within the
 *                         allowance `sniBuybackWethDaily` (0.1 WETH per UTC day)
 *
 * Not granted to any role, on purpose: 1inch swap() (caller-chosen executor
 * and srcReceiver), unoswapTo, multicall on either Uniswap contract, NPM
 * mint and burn, any transfer. So the Uniswap and 1inch web apps cannot be
 * used; this console builds only calls the grants accept and says so before
 * the wallet opens.
 *
 * There is no SNI/WETH pool on Polygon: every SNI ↔ WETH trade is two hops
 * through USDC.
 */

const bytes32 = (text: string) => ethers.encodeBytes32String(text);

export const SYC = {
  CHAIN: ChainId.POLYGON,
  EXPLORER: "https://polygonscan.com",
  /** Role 2, the main executor. The factory's own key, spelled correctly on this vault. */
  ROLE: "defaultManagerRole",
  /** Role 3, the buyback script. A custom role is named by its key. */
  BUYBACK_ROLE: "Buyback-Executor",
  BUYBACK_ALLOWANCE_KEY: bytes32("sniBuybackWethDaily"),
  /** The most one buyback may spend, and the daily budget. */
  BUYBACK_MAX: ethers.parseEther("0.1"),
  ADDR: {
    fund: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007",
    safe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF",
    roles: "0x8A984794a920BBd367B3e54362014dE973200aB0",
    npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    oneInch: ONE_INCH_ROUTER_V6,
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    poolUsdcWeth100: "0x80CdADE01Ff626B7CcE4772E3C2d56db14f384fA",
    poolUsdcWeth500: "0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9",
    poolUsdcWeth3000: "0x19C5505638383337D2972Ce68B493aD78E315147",
    poolUsdcWeth10000: "0x12bD7Ae45ACF2504BED144Eabc6FF5bBEbd91563",
    poolUsdcSni: "0x9Ecb733A74B48eE31586c98986F0AA1eD5057c6A",
  },
};

export interface SycToken extends SwapAsset {
  /** Chainlink USD feed on Polygon, 8 decimals. SNI has none: it is priced off its pool. */
  feed?: string;
}

export const SYC_TOKENS: SycToken[] = [
  {
    symbol: "WETH",
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    decimals: 18,
    feed: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
  },
  {
    symbol: "USDC",
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    feed: "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7",
  },
  {
    symbol: "SNI",
    address: "0xDc685aCC53CA2A760029Cab2F6a587482Aa9CF57",
    decimals: 18,
  },
];

export const sycToken = (symbol: string): SycToken =>
  SYC_TOKENS.find((t) => t.symbol === symbol) ?? SYC_TOKENS[0];

export const sycTokenAt = (address: string): SycToken | undefined =>
  SYC_TOKENS.find((t) => t.address.toLowerCase() === (address || "").toLowerCase());

const same = (a: string, b: string) => (a || "").toLowerCase() === (b || "").toLowerCase();

const WETH = sycToken("WETH");
const USDC = sycToken("USDC");
const SNI = sycToken("SNI");
const A = SYC.ADDR;
const MAX_UINT128 = (1n << 128n) - 1n;

export interface SycPool extends AllowedPool {
  fee: number;
  tickSpacing: number;
}

const feeLabel = (fee: number) => `${(fee / 10000).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

const pool = (address: string, token1: SycToken, fee: number, tickSpacing: number): SycPool => ({
  address,
  // USDC sorts before both WETH and SNI, so it is token0 in every pool here.
  tokens: [USDC, token1],
  fee,
  tickSpacing,
  label: `Uniswap V3 ${token1.symbol}/USDC ${feeLabel(fee)}`,
});

/**
 * Every pool the grants can reach: WETH/USDC at the four fee tiers (any fee
 * is allowed for a single hop, and each tier is one of the pinned two-hop
 * paths) and the one SNI/USDC pool. All five exist on Polygon.
 */
export const SYC_POOLS: SycPool[] = [
  pool(A.poolUsdcWeth100, WETH, 100, 1),
  pool(A.poolUsdcWeth500, WETH, 500, 10),
  pool(A.poolUsdcWeth3000, WETH, 3000, 60),
  pool(A.poolUsdcWeth10000, WETH, 10000, 200),
  pool(A.poolUsdcSni, SNI, 3000, 60),
];

export const sycPoolAt = (address: string): SycPool | undefined =>
  SYC_POOLS.find((p) => same(p.address, address));

/** The pool a position lives in, from its token pair and fee. */
export const sycPoolFor = (token0: string, token1: string, fee: number): SycPool | undefined =>
  SYC_POOLS.find((p) => same(p.tokens[0].address, token0) && same(p.tokens[1].address, token1) && p.fee === fee);

export const SNI_POOL = sycPoolAt(A.poolUsdcSni)!;

/* -------------------------------------------------------------------------- */
/* Interfaces and selectors                                                    */
/* -------------------------------------------------------------------------- */

export const IF = {
  erc20: new ethers.Interface([
    "function approve(address spender,uint256 amount)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ]),
  router02: new ethers.Interface([
    "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
    "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
    "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
    "function exactOutput((bytes path,address recipient,uint256 amountOut,uint256 amountInMaximum) params) payable returns (uint256 amountIn)",
  ]),
  npm: new ethers.Interface([
    "function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint128 liquidity,uint256 amount0,uint256 amount1)",
    "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint256 amount0,uint256 amount1)",
    "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max) params) payable returns (uint256 amount0,uint256 amount1)",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner,uint256 index) view returns (uint256)",
    "function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)",
  ]),
  quoter: new ethers.Interface([
    "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
    "function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)",
  ]),
  pool: new ethers.Interface([
    "function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)",
  ]),
  feed: new ethers.Interface([
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ]),
  roles: new ethers.Interface([
    "function allowances(bytes32 key) view returns (uint128 refill,uint128 maxRefill,uint64 period,uint128 balance,uint64 timestamp)",
  ]),
  multicall: new ethers.Interface([
    "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])",
    "function getCurrentBlockTimestamp() view returns (uint256 timestamp)",
  ]),
};

const selectorOf = (iface: ethers.Interface, name: string) => iface.getFunction(name)!.selector;

/** The selectors the grants name, as the modifier matches them. */
export const SYC_SELECTORS = {
  approve: selectorOf(IF.erc20, "approve"),
  exactInputSingle: selectorOf(IF.router02, "exactInputSingle"),
  exactOutputSingle: selectorOf(IF.router02, "exactOutputSingle"),
  exactInput: selectorOf(IF.router02, "exactInput"),
  exactOutput: selectorOf(IF.router02, "exactOutput"),
  unoswapTo2: UNOSWAP_TO2_SELECTOR,
  increaseLiquidity: selectorOf(IF.npm, "increaseLiquidity"),
  decreaseLiquidity: selectorOf(IF.npm, "decreaseLiquidity"),
  collect: selectorOf(IF.npm, "collect"),
};

/* -------------------------------------------------------------------------- */
/* The grants, as rules                                                        */
/* -------------------------------------------------------------------------- */

const WETH_USDC_FEES = [100, 500, 3000, 10000];

const packPath = (hops: (string | number)[]) =>
  ethers.solidityPacked(hops.map((h) => (typeof h === "number" ? "uint24" : "address")), hops);

/**
 * The eight paths `exactInput` / `exactOutput` are pinned to (compValue =
 * abi.encode(bytes)): SNI ⇄ USDC at 0.3%, USDC ⇄ WETH at each fee tier. The
 * set reads the same both ways, so it serves exactOutput's reversed paths.
 */
export const SYC_PATHS: string[] = WETH_USDC_FEES.flatMap((fee) => [
  packPath([SNI.address, 3000, USDC.address, fee, WETH.address]),
  packPath([WETH.address, fee, USDC.address, 3000, SNI.address]),
]).map((p) => p.toLowerCase());

/** The one 1inch route the grants allow: WETH → USDC (0.05%) → SNI (0.3%). */
export const SYC_ONEINCH_ROUTE = {
  token: WETH,
  dex: dexWord(A.poolUsdcWeth500, WETH.address, USDC.address),
  dex2: dexWord(A.poolUsdcSni, USDC.address, SNI.address),
};

/** Who the three tokens may be approved to. */
export const SYC_SPENDERS = [A.router02, A.npm, A.oneInch];

export interface SycCall {
  to: string;
  data: string;
}

export type SycRole = "executor" | "buyback";

export interface SycValidateContext {
  /**
   * The position ids the Safe owns, when known. The modifier checks
   * ownership itself (AvatarIsOwnerOfERC721); the console checks it first so
   * a foreign id is explained instead of denied.
   */
  ownedTokenIds?: bigint[];
}

const pinnedOneInchProblems = (data: string, maxAmount?: bigint): string[] => {
  const problems: string[] = [];
  const u = parseUnoswap(data);
  const R = SYC_ONEINCH_ROUTE;
  if (!same(u.to, A.safe)) problems.push(`Proceeds must land in the Safe, not ${shortAddress(u.to)}.`);
  if (!same(u.token, R.token.address)) problems.push("Through 1inch, only WETH may be sold.");
  if (u.dex.length !== 2 || u.dex[0] !== R.dex || u.dex[1] !== R.dex2) {
    problems.push("Through 1inch, the route must be exactly WETH → USDC (0.05%) → SNI (0.3%).");
  }
  if (maxAmount !== undefined && u.amount > maxAmount) {
    problems.push(`One buyback may spend at most ${ethers.formatEther(maxAmount)} WETH.`);
  }
  return problems;
};

/**
 * Everything the modifier would refuse in `call` for `role`, in the grants'
 * own terms, or an empty list when the role may make the call. Run on every
 * call this console builds, before the dry-run and before the wallet opens:
 * a denial should be explained, never discovered. The buyback's daily
 * allowance is not checked here — it moves with time and is read live.
 */
export const sycValidate = (call: SycCall, role: SycRole = "executor", ctx: SycValidateContext = {}): string[] => {
  const data = (call.data ?? "").trim();
  if (!/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10) return ["The calldata is not a function call."];
  const selector = data.slice(0, 10).toLowerCase();
  const S = SYC_SELECTORS;
  const problems: string[] = [];

  if (role === "buyback") {
    if (!same(call.to, A.oneInch) || selector !== S.unoswapTo2) {
      return ["The buyback role may only buy SNI with WETH through the pinned 1inch route."];
    }
    return pinnedOneInchProblems(data, SYC.BUYBACK_MAX);
  }

  const token = sycTokenAt(call.to);
  if (token) {
    if (selector !== S.approve) return [`${token.symbol} may only be approved, not called with ${selector}.`];
    const [spender] = IF.erc20.decodeFunctionData("approve", data);
    if (!SYC_SPENDERS.some((s) => same(s, spender))) {
      problems.push(`${token.symbol} may only be approved to SwapRouter02, the Uniswap position manager or the 1inch router, not ${shortAddress(spender)}.`);
    }
    return problems;
  }

  if (same(call.to, A.router02)) {
    if (selector === S.exactInputSingle || selector === S.exactOutputSingle) {
      const name = selector === S.exactInputSingle ? "exactInputSingle" : "exactOutputSingle";
      const [p] = IF.router02.decodeFunctionData(name, data);
      if (!sycTokenAt(p.tokenIn)) problems.push(`SwapRouter02 may not sell ${shortAddress(p.tokenIn)}.`);
      if (!sycTokenAt(p.tokenOut)) problems.push(`SwapRouter02 may not buy ${shortAddress(p.tokenOut)}.`);
      if (!same(p.recipient, A.safe)) problems.push(`Proceeds must land in the Safe, not ${shortAddress(p.recipient)}.`);
      return problems;
    }
    if (selector === S.exactInput || selector === S.exactOutput) {
      const name = selector === S.exactInput ? "exactInput" : "exactOutput";
      const [p] = IF.router02.decodeFunctionData(name, data);
      if (!SYC_PATHS.includes(String(p.path).toLowerCase())) {
        problems.push("A two-hop path must be SNI ⇄ USDC (0.3%) ⇄ WETH through one WETH/USDC pool.");
      }
      if (!same(p.recipient, A.safe)) problems.push(`Proceeds must land in the Safe, not ${shortAddress(p.recipient)}.`);
      return problems;
    }
    return [`SwapRouter02 ${selector} is not granted (multicall, sweep, unwrap and the V2 functions are not).`];
  }

  if (same(call.to, A.oneInch)) {
    if (selector !== S.unoswapTo2) {
      return [`1inch ${selector} is not granted (only the pinned unoswapTo2 buy route is; swap() and unoswapTo are not).`];
    }
    return pinnedOneInchProblems(data);
  }

  if (same(call.to, A.npm)) {
    const owned = (tokenId: bigint) =>
      !ctx.ownedTokenIds || ctx.ownedTokenIds.includes(tokenId)
        ? []
        : [`Position #${tokenId} is not owned by the Safe.`];
    if (selector === S.increaseLiquidity) {
      const [p] = IF.npm.decodeFunctionData("increaseLiquidity", data);
      return owned(p.tokenId as bigint);
    }
    if (selector === S.decreaseLiquidity) {
      const [p] = IF.npm.decodeFunctionData("decreaseLiquidity", data);
      return owned(p.tokenId as bigint);
    }
    if (selector === S.collect) {
      const [p] = IF.npm.decodeFunctionData("collect", data);
      if (!same(p.recipient, A.safe)) problems.push(`Collected tokens must land in the Safe, not ${shortAddress(p.recipient)}.`);
      return [...owned(p.tokenId as bigint), ...problems];
    }
    return [`Position manager ${selector} is not granted (mint, burn, transfers and multicall are not).`];
  }

  return [`${shortAddress(call.to)} is not a target the executor may call.`];
};

/* -------------------------------------------------------------------------- */
/* Swap routes and venues                                                      */
/* -------------------------------------------------------------------------- */

export type SycVenue = "oneInch" | "uniswap";

export const VENUE_LABELS: Record<SycVenue, string> = {
  oneInch: "1inch unoswap",
  uniswap: "Uniswap SwapRouter02",
};

/** The contract the Safe's tokens must be approved to, per venue. */
export const venueSpender = (venue: SycVenue) => (venue === "oneInch" ? A.oneInch : A.router02);

/**
 * Every route between two vault assets the pools offer: each WETH/USDC fee
 * tier directly, SNI/USDC directly, and SNI ⇄ WETH as the two hops through
 * USDC at each WETH/USDC tier. Every one of them is one the grants allow on
 * SwapRouter02.
 */
export const sycRoutesBetween = (sell: SycToken, buy: SycToken): UnoswapRoute[] => {
  if (same(sell.address, buy.address)) return [];
  return routesBetween(SYC_POOLS, sell, buy);
};

/** Whether the 1inch grant covers this route: only the pinned WETH → SNI one. */
export const isOneInchRoute = (route: UnoswapRoute): boolean =>
  route.hops.length === 2 &&
  route.hops[0].word === SYC_ONEINCH_ROUTE.dex &&
  route.hops[1].word === SYC_ONEINCH_ROUTE.dex2;

/** The pinned 1inch route as a route object. */
export const sycOneInchRoute = (): UnoswapRoute =>
  sycRoutesBetween(WETH, SNI).find(isOneInchRoute)!;

export const routeLabel = (route: UnoswapRoute) =>
  route.hops
    .map((h, i) => `${i === 0 ? h.sell.symbol : ""} → ${h.buy.symbol} (${feeLabel(sycPoolAt(h.pool.address)!.fee)})`)
    .join(" ")
    .trim();

export interface SycSwapParams {
  route: UnoswapRoute;
  amountIn: bigint;
  minReturn: bigint;
}

/** The route as Uniswap's packed path: token, fee, token, fee, token. */
export const routePath = (route: UnoswapRoute): string => {
  const hops: (string | number)[] = [route.hops[0].sell.address];
  for (const hop of route.hops) hops.push(sycPoolAt(hop.pool.address)!.fee, hop.buy.address);
  return packPath(hops);
};

/** The Uniswap router call for a route: one pool as exactInputSingle, two as exactInput. */
export const buildUniswapSwap = ({ route, amountIn, minReturn }: SycSwapParams): SycCall => {
  if (route.hops.length === 1) {
    const hop = route.hops[0];
    return {
      to: A.router02,
      data: IF.router02.encodeFunctionData("exactInputSingle", [
        {
          tokenIn: hop.sell.address,
          tokenOut: hop.buy.address,
          fee: sycPoolAt(hop.pool.address)!.fee,
          recipient: A.safe,
          amountIn,
          amountOutMinimum: minReturn,
          sqrtPriceLimitX96: 0n,
        },
      ]),
    };
  }
  return {
    to: A.router02,
    data: IF.router02.encodeFunctionData("exactInput", [
      { path: routePath(route), recipient: A.safe, amountIn, amountOutMinimum: minReturn },
    ]),
  };
};

/** The 1inch router call for the pinned route: proceeds to the Safe, the two pools as dex words. */
export const buildOneInchSwap = ({ route, amountIn, minReturn }: SycSwapParams): SycCall => {
  if (!isOneInchRoute(route)) throw new Error("1inch may only trade the pinned WETH → USDC → SNI route.");
  return buildUnoswap({ safe: A.safe, route, amountIn, minReturn });
};

export const buildSwap = (venue: SycVenue, params: SycSwapParams): SycCall =>
  venue === "oneInch" ? buildOneInchSwap(params) : buildUniswapSwap(params);

/** Unlimited approval of `token` to `spender`, the way every venue expects it. */
export const buildApprove = (token: SycToken, spender: string): SycCall => ({
  to: token.address,
  data: IF.erc20.encodeFunctionData("approve", [spender, ethers.MaxUint256]),
});

/** The floor to put on a quote, in base units of the bought asset. */
export const minReturnFor = (amountOut: bigint, tolerancePct: number) =>
  (amountOut * BigInt(Math.round((100 - tolerancePct) * 10000))) / 1000000n;

/* -------------------------------------------------------------------------- */
/* Position manager calls                                                      */
/* -------------------------------------------------------------------------- */

export interface IncreaseParams {
  tokenId: bigint;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  deadline: bigint;
}

/** Adds the Safe's tokens to one of the Safe's own positions. */
export const buildIncreaseLiquidity = (p: IncreaseParams): SycCall => ({
  to: A.npm,
  data: IF.npm.encodeFunctionData("increaseLiquidity", [
    {
      tokenId: p.tokenId,
      amount0Desired: p.amount0Desired,
      amount1Desired: p.amount1Desired,
      amount0Min: p.amount0Min,
      amount1Min: p.amount1Min,
      deadline: p.deadline,
    },
  ]),
});

export interface DecreaseParams {
  tokenId: bigint;
  liquidity: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  deadline: bigint;
}

/** Takes liquidity out of a position; the tokens wait in it until collected. */
export const buildDecreaseLiquidity = (p: DecreaseParams): SycCall => ({
  to: A.npm,
  data: IF.npm.encodeFunctionData("decreaseLiquidity", [
    { tokenId: p.tokenId, liquidity: p.liquidity, amount0Min: p.amount0Min, amount1Min: p.amount1Min, deadline: p.deadline },
  ]),
});

/** Everything owed by a position (fees and removed liquidity), to the Safe. */
export const buildCollect = (tokenId: bigint): SycCall => ({
  to: A.npm,
  data: IF.npm.encodeFunctionData("collect", [
    { tokenId, recipient: A.safe, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 },
  ]),
});

/** Twenty minutes from now, as the Uniswap interface sets it. */
export const deadlineIn = (seconds = 20 * 60) => BigInt(Math.floor(Date.now() / 1000) + seconds);

/* -------------------------------------------------------------------------- */
/* Uniswap V3 arithmetic                                                       */
/* -------------------------------------------------------------------------- */

export const Q96 = 1n << 96n;
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

/**
 * TickMath.getSqrtRatioAtTick, the contract's own fixed-point routine, so
 * the amounts shown here are the amounts the pool would move.
 */
export const sqrtRatioAtTick = (tick: number): bigint => {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) throw new Error("Tick out of range.");
  const absTick = BigInt(Math.abs(tick));
  let ratio = (absTick & 0x1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  const steps: [bigint, bigint][] = [
    [0x2n, 0xfff97272373d413259a46990580e213an],
    [0x4n, 0xfff2e50f5f656932ef12357cf3c7fdccn],
    [0x8n, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
    [0x10n, 0xffcb9843d60f6159c9db58835c926644n],
    [0x20n, 0xff973b41fa98c081472e6896dfb254c0n],
    [0x40n, 0xff2ea16466c96a3843ec78b326b52861n],
    [0x80n, 0xfe5dee046a99a2a811c461f1969c3053n],
    [0x100n, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [0x200n, 0xf987a7253ac413176f2b074cf7815e54n],
    [0x400n, 0xf3392b0822b70005940c7a398e4b70f3n],
    [0x800n, 0xe7159475a2c29b7443b29c7fa6e889d9n],
    [0x1000n, 0xd097f3bdfd2022b8845ad8f792aa5825n],
    [0x2000n, 0xa9f746462d870fdf8a65dc1f90e061e5n],
    [0x4000n, 0x70d869a156d2a1b890bb3df62baf32f7n],
    [0x8000n, 0x31be135f97d08fd981231505542fcfa6n],
    [0x10000n, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [0x20000n, 0x5d6af8dedb81196699c329225ee604n],
    [0x40000n, 0x2216e584f5fa1ea926041bedfe98n],
    [0x80000n, 0x48a170391f7dc42444e8fa2n],
  ];
  for (const [bit, mul] of steps) {
    if ((absTick & bit) !== 0n) ratio = (ratio * mul) >> 128n;
  }
  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;
  // Round up from Q128.128 to Q64.96.
  return (ratio >> 32n) + ((ratio % (1n << 32n)) === 0n ? 0n : 1n);
};

/** LiquidityAmounts.getAmount0ForLiquidity. */
export const amount0ForLiquidity = (sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return ((liquidity << 96n) * (sqrtB - sqrtA)) / sqrtB / sqrtA;
};

/** LiquidityAmounts.getAmount1ForLiquidity. */
export const amount1ForLiquidity = (sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (liquidity * (sqrtB - sqrtA)) / Q96;
};

/** LiquidityAmounts.getAmountsForLiquidity: what a position holds at the current price. */
export const amountsForLiquidity = (
  sqrtP: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  if (sqrtP <= sqrtA) return { amount0: amount0ForLiquidity(sqrtA, sqrtB, liquidity), amount1: 0n };
  if (sqrtP < sqrtB) {
    return {
      amount0: amount0ForLiquidity(sqrtP, sqrtB, liquidity),
      amount1: amount1ForLiquidity(sqrtA, sqrtP, liquidity),
    };
  }
  return { amount0: 0n, amount1: amount1ForLiquidity(sqrtA, sqrtB, liquidity) };
};

export const liquidityForAmount0 = (sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (amount0 * ((sqrtA * sqrtB) / Q96)) / (sqrtB - sqrtA);
};

export const liquidityForAmount1 = (sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (amount1 * Q96) / (sqrtB - sqrtA);
};

/**
 * One token1 in token0, at a tick, as people read it: for USDC/SNI that is
 * USDC per SNI, for USDC/WETH USDC per WETH. The pool's own number is token1
 * base units per token0 base unit, 1.0001^tick.
 */
export const tickToPrice = (tick: number, p: SycPool = SNI_POOL): number => {
  const [t0, t1] = p.tokens;
  return 10 ** (t1.decimals - t0.decimals) / 1.0001 ** tick;
};

/** Whether a position spans the pool's whole price range. */
export const isFullRange = (tickLower: number, tickUpper: number, p: SycPool): boolean =>
  tickLower <= Math.ceil(MIN_TICK / p.tickSpacing) * p.tickSpacing &&
  tickUpper >= Math.floor(MAX_TICK / p.tickSpacing) * p.tickSpacing;

/**
 * Given one side of a deposit into a range, the other side the range and
 * the current price call for. Null when the price sits outside the range,
 * since such a position takes only one token.
 */
export const pairedAmount = (
  sqrtP: bigint,
  tickLower: number,
  tickUpper: number,
  known: { amount0: bigint } | { amount1: bigint },
): bigint | null => {
  const sqrtA = sqrtRatioAtTick(tickLower);
  const sqrtB = sqrtRatioAtTick(tickUpper);
  if (sqrtP <= sqrtA || sqrtP >= sqrtB) return null;
  if ("amount0" in known) {
    return amount1ForLiquidity(sqrtA, sqrtP, liquidityForAmount0(sqrtP, sqrtB, known.amount0));
  }
  return amount0ForLiquidity(sqrtP, sqrtB, liquidityForAmount1(sqrtA, sqrtP, known.amount1));
};

/** Which token a deposit into the range takes when the price is outside it; null when both. */
export const singleSide = (sqrtP: bigint, tickLower: number, tickUpper: number): 0 | 1 | null => {
  if (sqrtP <= sqrtRatioAtTick(tickLower)) return 0;
  if (sqrtP >= sqrtRatioAtTick(tickUpper)) return 1;
  return null;
};

/* -------------------------------------------------------------------------- */
/* The buyback allowance                                                       */
/* -------------------------------------------------------------------------- */

export interface SycAllowance {
  refill: bigint;
  maxRefill: bigint;
  period: bigint;
  balance: bigint;
  timestamp: bigint;
}

/**
 * The allowance as the modifier will see it at `now`: Roles v2's
 * _accruedAllowance — whole periods since `timestamp` refill the balance,
 * capped at maxRefill, and the timestamp moves to the start of the current
 * period. Returns what may be spent now and when the next refill lands.
 */
export const accruedAllowance = (a: SycAllowance, now: bigint): { available: bigint; nextRefill: bigint } => {
  let { balance, timestamp } = a;
  if (a.period > 0n && now >= timestamp + a.period) {
    const elapsed = (now - timestamp) / a.period;
    if (balance < a.maxRefill) {
      balance += a.refill * elapsed;
      if (balance > a.maxRefill) balance = a.maxRefill;
    }
    timestamp += elapsed * a.period;
  }
  return { available: balance, nextRefill: a.period > 0n ? timestamp + a.period : 0n };
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export interface SycHolding {
  token: SycToken;
  balance: bigint;
  /** USD per whole token. Zero when unknown. */
  price: number;
  usd: number;
  /** Allowance granted by the Safe, per spender (lowercased). */
  allowance: Record<string, bigint>;
}

export interface SycPoolState {
  pool: SycPool;
  sqrtPriceX96: bigint;
  tick: number;
}

export interface SycPosition {
  tokenId: bigint;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  /** The pool among SYC_POOLS, when the position is in one. */
  pool?: SycPool;
  /** What the liquidity is worth at the current price. */
  amount0: bigint;
  amount1: bigint;
  /** Everything a collect would pay out right now: fees plus removed liquidity. */
  collectable0: bigint;
  collectable1: bigint;
  inRange: boolean;
}

export interface SycState {
  holdings: SycHolding[];
  totalUsd: number;
  pools: SycPoolState[];
  positions: SycPosition[];
  /** USDC per SNI from the SNI pool's current tick. */
  sniPriceUsdc: number;
  /** USD per SNI. */
  sniPrice: number;
  buyback: SycAllowance | null;
  /** The chain's clock at the read. */
  now: bigint;
}

const decode = (types: string[], hex: string) => ethers.AbiCoder.defaultAbiCoder().decode(types, hex);

type Aggregate3Result = { success: boolean; returnData: string }[];

const aggregate3 = async (calls: { target: string; callData: string }[]): Promise<Aggregate3Result> => {
  if (!calls.length) return [];
  const hex = await ethCallOn(
    SYC.CHAIN,
    A.multicall3,
    IF.multicall.encodeFunctionData("aggregate3", [
      calls.map((c) => ({ target: c.target, allowFailure: true, callData: c.callData })),
    ]),
  );
  return IF.multicall.decodeFunctionResult("aggregate3", hex)[0] as Aggregate3Result;
};

const uintOrZero = (r: { success: boolean; returnData: string } | undefined): bigint => {
  if (!r?.success || r.returnData === "0x") return 0n;
  try {
    return decode(["uint256"], r.returnData)[0] as bigint;
  } catch {
    return 0n;
  }
};

/** One snapshot: balances, allowances, the pools, the positions and the buyback budget. */
export const sycReadState = async (): Promise<SycState> => {
  const calls: { target: string; callData: string }[] = [];
  const idx: Record<string, number> = {};
  const push = (key: string, target: string, callData: string) => {
    idx[key] = calls.length;
    calls.push({ target, callData });
  };
  for (const token of SYC_TOKENS) {
    push(`bal:${token.symbol}`, token.address, IF.erc20.encodeFunctionData("balanceOf", [A.safe]));
    for (const spender of SYC_SPENDERS) {
      push(`al:${token.symbol}:${spender}`, token.address, IF.erc20.encodeFunctionData("allowance", [A.safe, spender]));
    }
    if (token.feed) push(`feed:${token.symbol}`, token.feed, IF.feed.encodeFunctionData("latestRoundData", []));
  }
  for (const p of SYC_POOLS) push(`slot0:${p.address}`, p.address, IF.pool.encodeFunctionData("slot0", []));
  push("npm:count", A.npm, IF.npm.encodeFunctionData("balanceOf", [A.safe]));
  push("allowance", A.roles, IF.roles.encodeFunctionData("allowances", [SYC.BUYBACK_ALLOWANCE_KEY]));
  push("now", A.multicall3, IF.multicall.encodeFunctionData("getCurrentBlockTimestamp", []));

  const first = await aggregate3(calls);
  const at = (key: string) => first[idx[key]];

  const pools: SycPoolState[] = SYC_POOLS.map((p) => {
    const r = at(`slot0:${p.address}`);
    if (!r?.success) return { pool: p, sqrtPriceX96: 0n, tick: 0 };
    const s = IF.pool.decodeFunctionResult("slot0", r.returnData);
    return { pool: p, sqrtPriceX96: s[0] as bigint, tick: Number(s[1]) };
  });
  const sniPool = pools.find((p) => same(p.pool.address, SNI_POOL.address))!;
  const feedPrice = (symbol: string) => {
    const r = at(`feed:${symbol}`);
    if (!r?.success) return 0;
    try {
      const round = IF.feed.decodeFunctionResult("latestRoundData", r.returnData);
      return Number(ethers.formatUnits(round[1] as bigint, 8));
    } catch {
      return 0;
    }
  };
  const usdcPrice = feedPrice("USDC");
  const sniPriceUsdc = sniPool.sqrtPriceX96 > 0n ? tickToPrice(sniPool.tick) : 0;
  const sniPrice = sniPriceUsdc * (usdcPrice || 1);

  const holdings = SYC_TOKENS.map((token): SycHolding => {
    const balance = uintOrZero(at(`bal:${token.symbol}`));
    const price = token.symbol === "SNI" ? sniPrice : feedPrice(token.symbol);
    const allowance: Record<string, bigint> = {};
    for (const spender of SYC_SPENDERS) allowance[spender.toLowerCase()] = uintOrZero(at(`al:${token.symbol}:${spender}`));
    return { token, balance, price, usd: Number(ethers.formatUnits(balance, token.decimals)) * price, allowance };
  });

  let buyback: SycAllowance | null = null;
  const al = at("allowance");
  if (al?.success) {
    const r = IF.roles.decodeFunctionResult("allowances", al.returnData);
    buyback = {
      refill: r.refill as bigint,
      maxRefill: r.maxRefill as bigint,
      period: r.period as bigint,
      balance: r.balance as bigint,
      timestamp: r.timestamp as bigint,
    };
  }
  const now = uintOrZero(at("now")) || BigInt(Math.floor(Date.now() / 1000));

  // Positions: ids by index, then each position. What a collect would pay
  // has to be asked as the Safe, since the manager only answers an owner.
  const count = Number(uintOrZero(at("npm:count")));
  let positions: SycPosition[] = [];
  if (count > 0) {
    const ids = await aggregate3(
      Array.from({ length: count }, (_, i) => ({
        target: A.npm,
        callData: IF.npm.encodeFunctionData("tokenOfOwnerByIndex", [A.safe, i]),
      })),
    );
    const tokenIds = ids.map(uintOrZero).filter((id) => id > 0n);
    const raw = await aggregate3(
      tokenIds.map((id) => ({ target: A.npm, callData: IF.npm.encodeFunctionData("positions", [id]) })),
    );
    const collectables = await Promise.all(
      tokenIds.map((id) => readCollectable(id).catch(() => ({ amount0: 0n, amount1: 0n }))),
    );
    positions = tokenIds.map((tokenId, i) => {
      const p = IF.npm.decodeFunctionResult("positions", raw[i].returnData);
      const tickLower = Number(p.tickLower);
      const tickUpper = Number(p.tickUpper);
      const liquidity = p.liquidity as bigint;
      const known = sycPoolFor(p.token0, p.token1, Number(p.fee));
      const state = known ? pools.find((x) => same(x.pool.address, known.address)) : undefined;
      const amounts =
        state && state.sqrtPriceX96 > 0n
          ? amountsForLiquidity(state.sqrtPriceX96, sqrtRatioAtTick(tickLower), sqrtRatioAtTick(tickUpper), liquidity)
          : { amount0: 0n, amount1: 0n };
      return {
        tokenId,
        token0: p.token0,
        token1: p.token1,
        fee: Number(p.fee),
        tickLower,
        tickUpper,
        liquidity,
        pool: known,
        amount0: amounts.amount0,
        amount1: amounts.amount1,
        collectable0: collectables[i].amount0,
        collectable1: collectables[i].amount1,
        inRange: !!state && state.tick >= tickLower && state.tick < tickUpper,
      };
    });
  }

  return {
    holdings,
    totalUsd: holdings.reduce((sum, h) => sum + h.usd, 0),
    pools,
    positions,
    sniPriceUsdc,
    sniPrice,
    buyback,
    now,
  };
};

/** What `collect` would pay the Safe for a position right now, asked without paying. */
export const readCollectable = async (tokenId: bigint): Promise<{ amount0: bigint; amount1: bigint }> => {
  const { to, data } = buildCollect(tokenId);
  const hex = await ethCallOn(SYC.CHAIN, to, data, A.safe);
  const [amount0, amount1] = IF.npm.decodeFunctionResult("collect", hex);
  return { amount0: amount0 as bigint, amount1: amount1 as bigint };
};

/** What the Safe holds of one asset, right now. */
export const sycSafeBalance = async (token: SycToken): Promise<bigint> => {
  const hex = await ethCallOn(SYC.CHAIN, token.address, IF.erc20.encodeFunctionData("balanceOf", [A.safe]));
  return decode(["uint256"], hex)[0] as bigint;
};

/* -------------------------------------------------------------------------- */
/* Quotes                                                                      */
/* -------------------------------------------------------------------------- */

export interface SycQuote {
  venue: SycVenue;
  route: UnoswapRoute;
  amountIn: bigint;
  amountOut: bigint;
  /**
   * "venue"  the identical router call simulated from the Safe (its own
   *          arithmetic; only possible once the Safe holds the amount and
   *          has approved that venue);
   * "quoter" Uniswap's QuoterV2 over the same pools, which both venues
   *          trade, so the number is the same to the wei.
   */
  source: "venue" | "quoter";
  /** The Safe must approve the sold token to this venue before swapping. */
  needsApproval: boolean;
}

/** QuoterV2 over the route's pools: pool arithmetic, no tokens or allowance needed. */
export const quoteViaQuoter = async (route: UnoswapRoute, amountIn: bigint): Promise<bigint | null> => {
  try {
    if (route.hops.length === 1) {
      const hop = route.hops[0];
      const hex = await ethCallOn(
        SYC.CHAIN,
        A.quoterV2,
        IF.quoter.encodeFunctionData("quoteExactInputSingle", [
          { tokenIn: hop.sell.address, tokenOut: hop.buy.address, amountIn, fee: sycPoolAt(hop.pool.address)!.fee, sqrtPriceLimitX96: 0n },
        ]),
      );
      return IF.quoter.decodeFunctionResult("quoteExactInputSingle", hex)[0] as bigint;
    }
    const hex = await ethCallOn(SYC.CHAIN, A.quoterV2, IF.quoter.encodeFunctionData("quoteExactInput", [routePath(route), amountIn]));
    return IF.quoter.decodeFunctionResult("quoteExactInput", hex)[0] as bigint;
  } catch {
    return null;
  }
};

/**
 * The venue's own answer: the identical call eth_call'd from the Safe with a
 * floor of 1. Reverts (no allowance, no balance) come back as null.
 */
export const quoteViaVenue = async (venue: SycVenue, route: UnoswapRoute, amountIn: bigint): Promise<bigint | null> => {
  const { to, data } = buildSwap(venue, { route, amountIn, minReturn: 1n });
  try {
    const hex = await ethCallOn(SYC.CHAIN, to, data, A.safe);
    const out = decode(["uint256"], hex)[0] as bigint;
    return out > 0n ? out : null;
  } catch {
    return null;
  }
};

/** Every venue and route the grants allow for the pair, as candidates to price. */
export const swapCandidates = (sell: SycToken, buy: SycToken): { venue: SycVenue; route: UnoswapRoute }[] => {
  const routes = sycRoutesBetween(sell, buy);
  return [
    ...routes.map((route) => ({ venue: "uniswap" as const, route })),
    ...routes.filter(isOneInchRoute).map((route) => ({ venue: "oneInch" as const, route })),
  ];
};

/**
 * Every candidate priced, best first. Where the Safe has approved a venue
 * (and holds the amount), that venue's own simulation is the price;
 * otherwise the quoter's. Equal outputs are settled by the fewest
 * transactions: an approved venue beats one that still needs an approval,
 * and 1inch, whose WETH approval the buyback shares, beats the router.
 */
export const quoteSwap = async (
  sell: SycToken,
  buy: SycToken,
  amountIn: bigint,
  allowances: Record<SycVenue, bigint>,
  canSimulate: boolean,
): Promise<SycQuote[]> => {
  const quotes = await Promise.all(
    swapCandidates(sell, buy).map(async ({ venue, route }): Promise<SycQuote | null> => {
      const approved = allowances[venue] >= amountIn;
      let amountOut = approved && canSimulate ? await quoteViaVenue(venue, route, amountIn) : null;
      let source: SycQuote["source"] = "venue";
      if (amountOut === null) {
        amountOut = await quoteViaQuoter(route, amountIn);
        source = "quoter";
      }
      if (amountOut === null || amountOut <= 0n) return null;
      return { venue, route, amountIn, amountOut, source, needsApproval: !approved };
    }),
  );
  const rank = (q: SycQuote) => (q.needsApproval ? 2 : 0) + (q.venue === "oneInch" ? 0 : 1);
  return quotes
    .filter((q): q is SycQuote => !!q)
    .sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : rank(a) - rank(b)));
};

/* -------------------------------------------------------------------------- */
/* Denials, formatting                                                         */
/* -------------------------------------------------------------------------- */

const ROLE_NAMES: Record<SycRole, string> = { executor: "an Executor", buyback: "a Buyback-Executor" };

/** The shared dry-run's reason, in this vault's terms. */
export const sycExplainDenial = (reason: string | undefined, role: SycRole = "executor"): string => {
  const text = reason || "";
  if (/does not hold the role|no ?membership|holds no role/i.test(text)) {
    return `The connected wallet is not ${ROLE_NAMES[role]} of this vault.`;
  }
  if (/status 5\b/.test(text)) return "A value is not one of those the permission allows (a token, spender or path).";
  if (/status 9\b/.test(text)) return "One buyback may spend at most 0.1 WETH.";
  if (/status 16\b/.test(text)) return "The position is not owned by the Safe.";
  if (/status 17\b/.test(text)) return "Today's 0.1 WETH buyback budget is already spent. It refills at 00:00 UTC.";
  return text || "The Roles modifier does not allow this for the connected wallet.";
};

/** Money for reading, never for maths. */
export const fmtUnits = (v: bigint, decimals: number, dp = 4) =>
  Number(ethers.formatUnits(v ?? 0n, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  });

export const fmtUsd = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A price with as many digits as it needs to be read. */
export const fmtPrice = (p: number) => {
  if (!Number.isFinite(p) || p <= 0) return "0";
  if (p >= 1e9) return "∞";
  const digits = p < 0.01 ? 6 : p < 1 ? 5 : p < 100 ? 4 : 2;
  return p.toLocaleString("en-US", { maximumFractionDigits: digits });
};

/** The whole-token amount as base units, or null when the text is not a positive number. */
export const parseAmount = (value: string, decimals: number): bigint | null => {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text || !/^\d*\.?\d*$/.test(text) || text === ".") return null;
  try {
    const parsed = ethers.parseUnits(text, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
};

/** A percentage typed by the operator, or null outside (0, 50]. */
export const parsePct = (value: string): number | null => {
  const n = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 50 ? n : null;
};

/** amount less `pct` percent, for the floors sent with a deposit or a removal. */
export const lessPct = (amount: bigint, pct: number): bigint =>
  (amount * BigInt(Math.round((100 - pct) * 10000))) / 1000000n;

/** A UTC time of day, for the buyback's next refill. */
export const fmtUtc = (seconds: bigint) => {
  const d = new Date(Number(seconds) * 1000);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
};
