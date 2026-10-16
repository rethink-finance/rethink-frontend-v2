import { ethers } from "ethers";
import {
  UNOSWAP_TO2_SELECTOR,
  UNOSWAP_TO_SELECTOR,
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
 * SNI Yield Claim Vault (SYC v2, Polygon) execution console: addresses, the
 * executor's grants as the console knows them, calldata builders, the
 * Uniswap V3 arithmetic the position card needs, reads and quotes.
 *
 * The vault runs Zodiac Roles v2. Its executor role may, beside the app's
 * standard switches, do exactly this (the raw batch built in
 * syc-v2-permissions/scripts/build-perms.cjs, 68 checks on the live
 * modifier):
 *
 *   SNI, WETH, USDC    approve(spender one-of Uniswap NPM, SwapRouter02, 1inch)
 *   SwapRouter02       exactInputSingle(tokenIn, tokenOut one-of the three,
 *                        any fee, recipient == Safe)
 *                      exactInput(path == WETH→USDC→SNI or SNI→USDC→WETH,
 *                        recipient == Safe)
 *   1inch v6           unoswapTo(to == Safe, token one-of the three, pool
 *                        one-of the two listed, either direction)
 *                      unoswapTo2(to == Safe, exactly WETH→USDC→SNI or
 *                        SNI→USDC→WETH through those pools)
 *   Uniswap NPM        mint(USDC/SNI 0.3 %, any range, recipient == Safe)
 *                      decreaseLiquidity, burn (any owned position)
 *                      collect(recipient == Safe)
 *
 * Not granted, on purpose: 1inch swap() (drain path), increaseLiquidity
 * (tokenId is caller-chosen), multicall on either Uniswap contract (so the
 * Uniswap and 1inch web apps cannot be used by the executor). This console
 * builds only calls the grants accept, and says so before the wallet opens.
 *
 * There is no SNI/WETH pool on Polygon: every SNI ↔ WETH trade is two hops
 * through USDC, which is why USDC is a vault asset.
 */

export const SYC = {
  CHAIN: ChainId.POLYGON,
  EXPLORER: "https://polygonscan.com",
  /** The executor role key on this factory (spelled correctly here). */
  ROLE: "defaultManagerRole",
  ADDR: {
    fund: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007",
    safe: "0x3Fca31E56706b5461DB54DcfeeFda9912cbe5ddF",
    roles: "0x8A984794a920BBd367B3e54362014dE973200aB0",
    npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    oneInch: ONE_INCH_ROUTER_V6,
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    poolWethUsdc: "0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9",
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

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface SycPool extends AllowedPool {
  fee: number;
  tickSpacing: number;
}

/**
 * The two pools the grants list. token order is the pool's own (token0
 * first): USDC sorts before both WETH and SNI.
 */
export const SYC_POOLS: SycPool[] = [
  {
    address: SYC.ADDR.poolWethUsdc,
    tokens: [sycToken("USDC"), sycToken("WETH")],
    fee: 500,
    tickSpacing: 10,
    label: "Uniswap V3 WETH/USDC 0.05%",
  },
  {
    address: SYC.ADDR.poolUsdcSni,
    tokens: [sycToken("USDC"), sycToken("SNI")],
    fee: 3000,
    tickSpacing: 60,
    label: "Uniswap V3 USDC/SNI 0.3%",
  },
];

/** The position pool: the only one `mint` is granted for. */
export const SYC_LP_POOL = SYC_POOLS[1];

export const sycPoolAt = (address: string): SycPool | undefined =>
  SYC_POOLS.find((p) => same(p.address, address));

const A = SYC.ADDR;
const MAX_UINT128 = (1n << 128n) - 1n;

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
    "function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)",
  ]),
  npm: new ethers.Interface([
    "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline) params) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
    "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint256 amount0,uint256 amount1)",
    "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max) params) payable returns (uint256 amount0,uint256 amount1)",
    "function burn(uint256 tokenId) payable",
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
  multicall: new ethers.Interface([
    "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])",
  ]),
};

const selectorOf = (iface: ethers.Interface, name: string) => iface.getFunction(name)!.selector;

/** The selectors the grants name, as the modifier matches them. */
export const SYC_SELECTORS = {
  approve: selectorOf(IF.erc20, "approve"),
  exactInputSingle: selectorOf(IF.router02, "exactInputSingle"),
  exactInput: selectorOf(IF.router02, "exactInput"),
  unoswapTo: UNOSWAP_TO_SELECTOR,
  unoswapTo2: UNOSWAP_TO2_SELECTOR,
  mint: selectorOf(IF.npm, "mint"),
  decreaseLiquidity: selectorOf(IF.npm, "decreaseLiquidity"),
  collect: selectorOf(IF.npm, "collect"),
  burn: selectorOf(IF.npm, "burn"),
};

/* -------------------------------------------------------------------------- */
/* The grants, as rules                                                        */
/* -------------------------------------------------------------------------- */

const WETH = sycToken("WETH");
const USDC = sycToken("USDC");
const SNI = sycToken("SNI");

/** The exact `exactInput` paths pinned (compValue = abi.encode(bytes)). */
export const SYC_PATHS = {
  WETH_TO_SNI: ethers.solidityPacked(
    ["address", "uint24", "address", "uint24", "address"],
    [WETH.address, 500, USDC.address, 3000, SNI.address],
  ),
  SNI_TO_WETH: ethers.solidityPacked(
    ["address", "uint24", "address", "uint24", "address"],
    [SNI.address, 3000, USDC.address, 500, WETH.address],
  ),
};

/** The four `unoswapTo` dex words pinned, by direction. */
export const SYC_DEX_WORDS = {
  WETH_TO_USDC: dexWord(A.poolWethUsdc, WETH.address, USDC.address),
  USDC_TO_WETH: dexWord(A.poolWethUsdc, USDC.address, WETH.address),
  USDC_TO_SNI: dexWord(A.poolUsdcSni, USDC.address, SNI.address),
  SNI_TO_USDC: dexWord(A.poolUsdcSni, SNI.address, USDC.address),
};

/** The two `unoswapTo2` routes pinned, word for word. */
export const SYC_TWO_HOP_ROUTES: { token: SycToken; dex: bigint; dex2: bigint }[] = [
  { token: WETH, dex: SYC_DEX_WORDS.WETH_TO_USDC, dex2: SYC_DEX_WORDS.USDC_TO_SNI },
  { token: SNI, dex: SYC_DEX_WORDS.SNI_TO_USDC, dex2: SYC_DEX_WORDS.USDC_TO_WETH },
];

/** Who the three tokens may be approved to. */
export const SYC_SPENDERS = [A.npm, A.router02, A.oneInch];

export interface SycCall {
  to: string;
  data: string;
}

/**
 * Everything the modifier would refuse in `call`, in the grants' own terms,
 * or an empty list when the call is one the executor may make. Run on every
 * call this console builds, before the dry-run and before the wallet opens:
 * a denial should be explained, never discovered.
 */
export const sycValidate = (call: SycCall): string[] => {
  const data = (call.data ?? "").trim();
  if (!/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10) return ["The calldata is not a function call."];
  const selector = data.slice(0, 10).toLowerCase();
  const S = SYC_SELECTORS;
  const problems: string[] = [];

  const token = sycTokenAt(call.to);
  if (token) {
    if (selector !== S.approve) return [`${token.symbol} may only be approved, not called with ${selector}.`];
    const [spender] = IF.erc20.decodeFunctionData("approve", data);
    if (!SYC_SPENDERS.some((s) => same(s, spender))) {
      problems.push(`${token.symbol} may only be approved to the Uniswap position manager, SwapRouter02 or the 1inch router, not ${shortAddress(spender)}.`);
    }
    return problems;
  }

  if (same(call.to, A.router02)) {
    if (selector === S.exactInputSingle) {
      const [p] = IF.router02.decodeFunctionData("exactInputSingle", data);
      if (!sycTokenAt(p.tokenIn)) problems.push(`SwapRouter02 may not sell ${shortAddress(p.tokenIn)}.`);
      if (!sycTokenAt(p.tokenOut)) problems.push(`SwapRouter02 may not buy ${shortAddress(p.tokenOut)}.`);
      if (!same(p.recipient, A.safe)) problems.push(`Proceeds must land in the Safe, not ${shortAddress(p.recipient)}.`);
      return problems;
    }
    if (selector === S.exactInput) {
      const [p] = IF.router02.decodeFunctionData("exactInput", data);
      const path = String(p.path).toLowerCase();
      if (path !== SYC_PATHS.WETH_TO_SNI.toLowerCase() && path !== SYC_PATHS.SNI_TO_WETH.toLowerCase()) {
        problems.push("The path must be exactly WETH → USDC → SNI or SNI → USDC → WETH through the two listed pools.");
      }
      if (!same(p.recipient, A.safe)) problems.push(`Proceeds must land in the Safe, not ${shortAddress(p.recipient)}.`);
      return problems;
    }
    return [`SwapRouter02.${selector} is not granted (only exactInputSingle and exactInput are; multicall is not).`];
  }

  if (same(call.to, A.oneInch)) {
    if (selector !== S.unoswapTo && selector !== S.unoswapTo2) {
      return [`1inch ${selector} is not granted (only unoswapTo and unoswapTo2 are; swap() is not).`];
    }
    const u = parseUnoswap(data);
    if (!same(u.to, A.safe)) problems.push(`Proceeds must land in the Safe, not ${shortAddress(u.to)}.`);
    if (!sycTokenAt(u.token)) problems.push(`1inch may not sell ${shortAddress(u.token)}.`);
    if (selector === S.unoswapTo) {
      const words = Object.values(SYC_DEX_WORDS);
      if (!words.includes(u.dex[0])) problems.push("The pool is not one of the two listed, in that direction.");
    } else {
      const ok = SYC_TWO_HOP_ROUTES.some(
        (r) => same(r.token.address, u.token) && r.dex === u.dex[0] && r.dex2 === u.dex[1],
      );
      if (!ok) problems.push("A two-hop route must be exactly WETH → USDC → SNI or SNI → USDC → WETH through the two listed pools.");
    }
    return problems;
  }

  if (same(call.to, A.npm)) {
    if (selector === S.mint) {
      const [p] = IF.npm.decodeFunctionData("mint", data);
      if (!same(p.token0, USDC.address) || !same(p.token1, SNI.address) || Number(p.fee) !== 3000) {
        problems.push("New positions may only be opened in the USDC/SNI 0.3% pool.");
      }
      if (!same(p.recipient, A.safe)) problems.push(`The position must be minted to the Safe, not ${shortAddress(p.recipient)}.`);
      return problems;
    }
    if (selector === S.collect) {
      const [p] = IF.npm.decodeFunctionData("collect", data);
      if (!same(p.recipient, A.safe)) problems.push(`Collected tokens must land in the Safe, not ${shortAddress(p.recipient)}.`);
      return problems;
    }
    if (selector === S.decreaseLiquidity || selector === S.burn) return [];
    return [`Position manager ${selector} is not granted (increaseLiquidity and multicall are not).`];
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
 * The one route between two vault assets the grants allow: a direct pool or
 * the two hops through USDC. Both venues trade the same pools, so a route is
 * venue-neutral and each venue is only a different way of writing it.
 */
export const sycRouteBetween = (sell: SycToken, buy: SycToken): UnoswapRoute | null => {
  if (same(sell.address, buy.address)) return null;
  const routes = routesBetween(SYC_POOLS, sell, buy);
  // Prefer the direct pool; the two-hop is only ever there for SNI ↔ WETH.
  routes.sort((a, b) => a.hops.length - b.hops.length);
  return routes[0] ?? null;
};

export const routeLabel = (route: UnoswapRoute) =>
  `${route.hops[0].sell.symbol}${route.hops.map((h) => ` → ${h.buy.symbol}`).join("")}`;

export interface SycSwapParams {
  route: UnoswapRoute;
  amountIn: bigint;
  minReturn: bigint;
}

/** The route as Uniswap's packed path: token, fee, token, fee, token. */
export const routePath = (route: UnoswapRoute): string => {
  const types: string[] = ["address"];
  const values: (string | number)[] = [route.hops[0].sell.address];
  for (const hop of route.hops) {
    types.push("uint24", "address");
    values.push(sycPoolAt(hop.pool.address)!.fee, hop.buy.address);
  }
  return ethers.solidityPacked(types, values);
};

/** The Uniswap router call for a route: one pool as exactInputSingle, two as exactInput. */
export const buildUniswapSwap = ({ route, amountIn, minReturn }: SycSwapParams): SycCall => {
  if (route.hops.length === 1) {
    const hop = route.hops[0];
    const pool = sycPoolAt(hop.pool.address)!;
    return {
      to: A.router02,
      data: IF.router02.encodeFunctionData("exactInputSingle", [
        {
          tokenIn: hop.sell.address,
          tokenOut: hop.buy.address,
          fee: pool.fee,
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
      {
        path: routePath(route),
        recipient: A.safe,
        amountIn,
        amountOutMinimum: minReturn,
      },
    ]),
  };
};

/** The 1inch router call for a route: proceeds to the Safe, pools as dex words. */
export const buildOneInchSwap = ({ route, amountIn, minReturn }: SycSwapParams): SycCall =>
  buildUnoswap({ safe: A.safe, route, amountIn, minReturn });

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

export interface MintParams {
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  deadline: bigint;
}

/** A new USDC/SNI 0.3 % position owned by the Safe. */
export const buildMint = (p: MintParams): SycCall => ({
  to: A.npm,
  data: IF.npm.encodeFunctionData("mint", [
    {
      token0: USDC.address,
      token1: SNI.address,
      fee: SYC_LP_POOL.fee,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      amount0Desired: p.amount0Desired,
      amount1Desired: p.amount1Desired,
      amount0Min: p.amount0Min,
      amount1Min: p.amount1Min,
      recipient: A.safe,
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

/** Burns an emptied position's NFT. The manager refuses one that still holds anything. */
export const buildBurn = (tokenId: bigint): SycCall => ({
  to: A.npm,
  data: IF.npm.encodeFunctionData("burn", [tokenId]),
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

const mulDivUp = (a: bigint, b: bigint, d: bigint) => {
  const p = a * b;
  return p / d + (p % d === 0n ? 0n : 1n);
};

/** LiquidityAmounts.getAmount0ForLiquidity (rounded up, as the pool charges on mint). */
export const amount0ForLiquidity = (sqrtA: bigint, sqrtB: bigint, liquidity: bigint, roundUp = false): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  const numerator = liquidity << 96n;
  if (roundUp) return mulDivUp(mulDivUp(numerator, sqrtB - sqrtA, sqrtB), 1n, sqrtA);
  return (numerator * (sqrtB - sqrtA)) / sqrtB / sqrtA;
};

/** LiquidityAmounts.getAmount1ForLiquidity. */
export const amount1ForLiquidity = (sqrtA: bigint, sqrtB: bigint, liquidity: bigint, roundUp = false): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return roundUp ? mulDivUp(liquidity, sqrtB - sqrtA, Q96) : (liquidity * (sqrtB - sqrtA)) / Q96;
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
  const intermediate = (sqrtA * sqrtB) / Q96;
  return (amount0 * intermediate) / (sqrtB - sqrtA);
};

export const liquidityForAmount1 = (sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (amount1 * Q96) / (sqrtB - sqrtA);
};

/** LiquidityAmounts.getLiquidityForAmounts: the most liquidity both amounts fund. */
export const liquidityForAmounts = (
  sqrtP: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint => {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  if (sqrtP <= sqrtA) return liquidityForAmount0(sqrtA, sqrtB, amount0);
  if (sqrtP < sqrtB) {
    const l0 = liquidityForAmount0(sqrtP, sqrtB, amount0);
    const l1 = liquidityForAmount1(sqrtA, sqrtP, amount1);
    return l0 < l1 ? l0 : l1;
  }
  return liquidityForAmount1(sqrtA, sqrtB, amount1);
};

/**
 * The USDC/SNI pool's price as people read it: USDC per SNI. The pool's own
 * number is SNI base units per USDC base unit, 1.0001^tick, so one SNI costs
 * 10^(18-6) / 1.0001^tick USDC.
 */
export const tickToPrice = (tick: number, pool: SycPool = SYC_LP_POOL): number => {
  const [t0, t1] = pool.tokens;
  return 10 ** (t1.decimals - t0.decimals) / 1.0001 ** tick;
};

/** The tick at which one token1 costs `price` token0, before snapping to the spacing. */
export const priceToTick = (price: number, pool: SycPool = SYC_LP_POOL): number => {
  const [t0, t1] = pool.tokens;
  if (!(price > 0)) throw new Error("Price must be positive.");
  return Math.log(10 ** (t1.decimals - t0.decimals) / price) / Math.log(1.0001);
};

/** Snap a tick to the pool's spacing, outward so the typed price stays inside the range. */
export const snapTick = (tick: number, spacing: number, direction: "down" | "up"): number => {
  const snapped = direction === "down" ? Math.floor(tick / spacing) * spacing : Math.ceil(tick / spacing) * spacing;
  const lowest = Math.ceil(MIN_TICK / spacing) * spacing;
  const highest = Math.floor(MAX_TICK / spacing) * spacing;
  return Math.max(lowest, Math.min(highest, snapped));
};

/**
 * A range typed as prices (USDC per SNI) as the ticks the position manager
 * takes. A higher price is a lower tick, so the min price sets the upper
 * tick and the max price the lower one; both snap outward.
 */
export const rangeFromPrices = (
  minPrice: number,
  maxPrice: number,
  pool: SycPool = SYC_LP_POOL,
): { tickLower: number; tickUpper: number } => {
  if (!(minPrice > 0) || !(maxPrice > minPrice)) throw new Error("The max price must be above the min price.");
  return {
    tickLower: snapTick(priceToTick(maxPrice, pool), pool.tickSpacing, "down"),
    tickUpper: snapTick(priceToTick(minPrice, pool), pool.tickSpacing, "up"),
  };
};

/** The widest range the pool accepts. */
export const fullRange = (pool: SycPool = SYC_LP_POOL): { tickLower: number; tickUpper: number } => ({
  tickLower: snapTick(MIN_TICK, pool.tickSpacing, "up"),
  tickUpper: snapTick(MAX_TICK, pool.tickSpacing, "down"),
});

/**
 * Given one side of a new position, the other side the range and the
 * current price call for: the amount1 that pairs with amount0, or the
 * reverse. Null when the price sits outside the range on that side, since
 * such a position takes only one token.
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
    const liquidity = liquidityForAmount0(sqrtP, sqrtB, known.amount0);
    return amount1ForLiquidity(sqrtA, sqrtP, liquidity);
  }
  const liquidity = liquidityForAmount1(sqrtA, sqrtP, known.amount1);
  return amount0ForLiquidity(sqrtP, sqrtB, liquidity);
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
  /** Allowance granted by the Safe, per spender. */
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
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  /** What the liquidity is worth at the current price. */
  amount0: bigint;
  amount1: bigint;
  /** Everything a collect would pay out right now: fees plus removed liquidity. */
  collectable0: bigint;
  collectable1: bigint;
  inRange: boolean;
  /** True for the pool the console manages (USDC/SNI 0.3 %). */
  managed: boolean;
}

export interface SycState {
  holdings: SycHolding[];
  totalUsd: number;
  pools: SycPoolState[];
  positions: SycPosition[];
  /** USDC per SNI from the pool's current tick. */
  sniPrice: number;
}

const decode = (types: string[], hex: string) => ethers.AbiCoder.defaultAbiCoder().decode(types, hex);

type Aggregate3Result = { success: boolean; returnData: string }[];

const aggregate3 = async (calls: { target: string; callData: string }[]): Promise<Aggregate3Result> => {
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

/** One snapshot of the Safe's balances, allowances, the pools and the positions. */
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
  for (const pool of SYC_POOLS) push(`slot0:${pool.address}`, pool.address, IF.pool.encodeFunctionData("slot0", []));
  push("npm:count", A.npm, IF.npm.encodeFunctionData("balanceOf", [A.safe]));

  const first = await aggregate3(calls);
  const at = (key: string) => first[idx[key]];

  const pools: SycPoolState[] = SYC_POOLS.map((pool) => {
    const r = at(`slot0:${pool.address}`);
    if (!r?.success) return { pool, sqrtPriceX96: 0n, tick: 0 };
    const s = IF.pool.decodeFunctionResult("slot0", r.returnData);
    return { pool, sqrtPriceX96: s[0] as bigint, tick: Number(s[1]) };
  });
  const lp = pools.find((p) => same(p.pool.address, SYC_LP_POOL.address))!;
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
  const sniPrice = lp.sqrtPriceX96 > 0n ? tickToPrice(lp.tick) * (usdcPrice || 1) : 0;

  const holdings = SYC_TOKENS.map((token): SycHolding => {
    const balance = uintOrZero(at(`bal:${token.symbol}`));
    const price = token.symbol === "SNI" ? sniPrice : feedPrice(token.symbol);
    const allowance: Record<string, bigint> = {};
    for (const spender of SYC_SPENDERS) allowance[spender.toLowerCase()] = uintOrZero(at(`al:${token.symbol}:${spender}`));
    return { token, balance, price, usd: Number(ethers.formatUnits(balance, token.decimals)) * price, allowance };
  });

  // Positions: ids by index, then each position; the collectable amounts
  // have to be asked from the Safe itself, since the manager only answers
  // a position's owner.
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
      const r = raw[i];
      const p = IF.npm.decodeFunctionResult("positions", r.returnData);
      const tickLower = Number(p.tickLower);
      const tickUpper = Number(p.tickUpper);
      const liquidity = p.liquidity as bigint;
      const pool = SYC_POOLS.find(
        (x) => same(x.tokens[0].address, p.token0) && same(x.tokens[1].address, p.token1) && x.fee === Number(p.fee),
      );
      const state = pool ? pools.find((x) => same(x.pool.address, pool.address)) : undefined;
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
        tokensOwed0: p.tokensOwed0 as bigint,
        tokensOwed1: p.tokensOwed1 as bigint,
        amount0: amounts.amount0,
        amount1: amounts.amount1,
        collectable0: collectables[i].amount0,
        collectable1: collectables[i].amount1,
        inRange: !!state && state.tick >= tickLower && state.tick < tickUpper,
        managed: !!pool && same(pool.address, SYC_LP_POOL.address),
      };
    });
  }

  return {
    holdings,
    totalUsd: holdings.reduce((sum, h) => sum + h.usd, 0),
    pools,
    positions,
    sniPrice,
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
   *          arithmetic; only possible once the Safe has approved that venue);
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

/**
 * Both venues priced for a route, best first. Where the Safe has approved a
 * venue, that venue's own simulation is the price; otherwise the quoter's.
 * Equal outputs (the pools are the same) are settled by the fewest
 * transactions: an approved venue beats one that still needs an approval,
 * and 1inch, whose approval the buyback bot shares, beats the Uniswap router.
 */
export const quoteBothVenues = async (
  route: UnoswapRoute,
  amountIn: bigint,
  allowances: Record<SycVenue, bigint>,
): Promise<SycQuote[]> => {
  const venues: SycVenue[] = ["oneInch", "uniswap"];
  const quotes = await Promise.all(
    venues.map(async (venue): Promise<SycQuote | null> => {
      const approved = allowances[venue] >= amountIn;
      let amountOut = approved ? await quoteViaVenue(venue, route, amountIn) : null;
      let source: SycQuote["source"] = "venue";
      if (amountOut === null) {
        amountOut = await quoteViaQuoter(route, amountIn);
        source = "quoter";
      }
      if (amountOut === null || amountOut <= 0n) return null;
      return { venue, route, amountIn, amountOut, source, needsApproval: !approved };
    }),
  );
  const rank = (q: SycQuote) => (q.needsApproval ? 1 : 0) * 2 + (q.venue === "oneInch" ? 0 : 1);
  return quotes
    .filter((q): q is SycQuote => !!q)
    .sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : rank(a) - rank(b)));
};

/* -------------------------------------------------------------------------- */
/* Denials, formatting                                                         */
/* -------------------------------------------------------------------------- */

const NOT_AN_EXECUTOR = "The connected wallet is not an executor of this vault.";

/** The shared dry-run's reason, in this vault's terms. */
export const sycExplainDenial = (reason: string | undefined): string => {
  const text = reason || "";
  if (text.includes("0x4a0bfec1") || /no ?membership|holds no role|does not hold the role/i.test(text)) return NOT_AN_EXECUTOR;
  if (/status 5\b/.test(text)) return "This route is not one of the two the permission pins.";
  if (/status 2\b|target address is not allowed/i.test(text)) return "The executor role has no grant for this contract yet.";
  if (/status 3\b|function is not allowed/i.test(text)) return "The executor role has no grant for this function yet.";
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

/** amount less `pct` percent, for the floors sent with a mint or a removal. */
export const lessPct = (amount: bigint, pct: number): bigint =>
  (amount * BigInt(Math.round((100 - pct) * 10000))) / 1000000n;
