import { ethers } from "ethers";
import {
  DOC,
  DOC_TOKENS,
  DOC_UNOSWAP_RULES,
  type DocRoute,
  type DocToken,
  encodeUnoswap,
  fmtUnits,
  routeCandidates,
  shortAddr,
} from "./docWhitelist";
import { UNOSWAP_TO2_SELECTOR, UNOSWAP_TO_SELECTOR, wordHex } from "./onchainSwap";
import { fetchOnChainRolesV1 } from "~/services/onchain/rolesV1";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ParamComparison } from "~/types/enums/zodiac-roles";

export * from "./docWhitelist";

/**
 * DoC Treasury Protection execution console — addresses, whitelist facts and
 * calldata builders.
 *
 * The vault runs Zodiac Roles **v1** (the modifier answers `multisend()`), and
 * its manager role is role 1. Everything below was read off the modifier's own
 * event log on Polygon and then confirmed by simulating each boundary from the
 * manager EOA — the PASS/DENY notes on each entry are what the live modifier
 * actually answered, not what the setup transaction intended.
 *
 * The whitelist, in full:
 *
 *   1inch AggregationRouterV6
 *     · as set up: `swap` (0x07ed2379) ONLY — desc.dstToken one-of the six
 *       supported assets, desc.dstReceiver pinned to the Safe, and srcToken,
 *       amount, minReturn, executor unconstrained; every other selector,
 *       `unoswap` included, → FunctionNotAllowed. That routing program can
 *       only be written by 1inch's pathfinder, which the 1inch web app no
 *       longer lets a manager steer, and its free executor slot is a drain
 *       path for a compromised key.
 *     · after the whitelist proposal (docProposal.ts): `unoswapTo` and
 *       `unoswapTo2` with `to` pinned to the Safe, `token` one-of the four
 *       vault assets and the pools one-of DOC_POOLS by slot (see
 *       DOC_UNOSWAP_RULES); `swap` revoked. readDocUnoswapGrant() tells the
 *       console which of the two worlds it is in.
 *     · msg.value must be 0 (options None → SendNotAllowed)
 *
 *   Aave v3 Pool
 *     · supply(asset, amount, onBehalfOf, ref) — onBehalfOf pinned to the Safe
 *     · withdraw(asset, amount, to)            — to pinned to the Safe
 *     · the asset is NOT pinned on either, but only DAI can be approved to the
 *       pool, so DAI is the only asset that can actually be supplied
 *
 *   ERC-20 approve
 *     · DAI            → 1inch OR the Aave pool (one-of)
 *     · WETH/WBTC/PAXG → 1inch only
 *     · WPOL           → the setup scoped this to role 0, so role 1 cannot
 *                        approve it at all; WPOL can be bought, never sold
 *     · USDC.e         → never scoped as a target; same one-way street
 */

const A = DOC.ADDR;

const IF = {
  erc20: new ethers.Interface([
    "function approve(address spender,uint256 amount)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ]),
  roles: new ethers.Interface([
    "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert) returns (bool)",
  ]),
  pool: new ethers.Interface([
    "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)",
    "function withdraw(address asset,uint256 amount,address to) returns (uint256)",
    "function getReserveData(address asset) view returns (tuple(tuple(uint256 data) configuration,uint128 liquidityIndex,uint128 currentLiquidityRate,uint128 variableBorrowIndex,uint128 currentVariableBorrowRate,uint128 currentStableBorrowRate,uint40 lastUpdateTimestamp,uint16 id,address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint128 accruedToTreasury,uint128 unbacked,uint128 isolationModeTotalDebt))",
  ]),
  oracle: new ethers.Interface(["function getAssetPrice(address) view returns (uint256)"]),
  feed: new ethers.Interface([
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ]),
};

export const fmtUsd = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The whole-token amount as base units, or null when the text is not a number. */
export const parseAmount = (value: string, decimals: number): bigint | null => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const parsed = ethers.parseUnits(text, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
};

/* -------------------------------------------------------------------------- */
/* Inner calls                                                                */
/* -------------------------------------------------------------------------- */

export interface DocParam {
  k: string;
  v: string;
  /** Fixed by the whitelist: any other value is a permission denial. */
  pinned?: boolean;
}
export interface DocInner {
  to: string;
  data: string;
  sig: string;
  params: DocParam[];
}

/** One simulated swap: where it goes, what it sells, what the router returned. */
export interface DocQuote {
  route: DocRoute;
  amountIn: bigint;
  amountOut: bigint;
  /** Against the oracle marks, so negative means value given up. */
  slippagePct: number;
}

const MAX_UINT256 = (1n << 256n) - 1n;

export const docInner = {
  approve: (token: DocToken, spender: string, spenderLabel: string): DocInner => ({
    to: token.address,
    data: IF.erc20.encodeFunctionData("approve", [spender, MAX_UINT256]),
    sig: `${token.symbol}.approve(spender, amount)`,
    params: [
      { k: "spender", v: `${spenderLabel} ${shortAddr(spender)}`, pinned: true },
      { k: "amount", v: "uint256.max (unlimited)" },
    ],
  }),

  aaveSupply: (token: DocToken, amount: bigint): DocInner => ({
    to: A.aavePool,
    data: IF.pool.encodeFunctionData("supply", [token.address, amount, A.safe, 0]),
    sig: "Pool.supply(asset, amount, onBehalfOf, referralCode)",
    params: [
      { k: "asset", v: token.symbol },
      { k: "amount", v: `${fmtUnits(amount, token.decimals)} ${token.symbol}` },
      { k: "onBehalfOf", v: `Safe ${shortAddr(A.safe)}`, pinned: true },
      { k: "referralCode", v: "0" },
    ],
  }),

  /**
   * `amount` as uint256.max is Aave's "withdraw everything, interest included"
   * sentinel — verified to pass the whitelist, since only `to` is pinned.
   */
  aaveWithdraw: (token: DocToken, amount: bigint | "max"): DocInner => ({
    to: A.aavePool,
    data: IF.pool.encodeFunctionData("withdraw", [
      token.address,
      amount === "max" ? MAX_UINT256 : amount,
      A.safe,
    ]),
    sig: "Pool.withdraw(asset, amount, to)",
    params: [
      { k: "asset", v: token.symbol },
      {
        k: "amount",
        v:
          amount === "max"
            ? "uint256.max (full position + interest)"
            : `${fmtUnits(amount, token.decimals)} ${token.symbol}`,
      },
      { k: "to", v: `Safe ${shortAddr(A.safe)}`, pinned: true },
    ],
  }),

  /**
   * A swap through named Uniswap V3 pools. Every argument is built here from
   * the quote taken moments before, so there is nothing opaque in the call:
   * the pools are readable, the floor is the operator's own tolerance applied
   * to a live quote, and the proceeds are pinned to the Safe.
   */
  unoswap: (
    src: DocToken,
    dst: DocToken,
    quote: DocQuote,
    minReturn: bigint,
  ): DocInner => ({
    to: A.oneInch,
    data: encodeUnoswap(quote.route, src, quote.amountIn, minReturn),
    sig:
      quote.route.hops.length === 1
        ? "AggregationRouterV6.unoswapTo(to, token, amount, minReturn, dex)"
        : "AggregationRouterV6.unoswapTo2(to, token, amount, minReturn, dex, dex2)",
    params: [
      { k: "to", v: `Safe ${shortAddr(A.safe)}`, pinned: true },
      { k: "sell", v: `${fmtUnits(quote.amountIn, src.decimals)} ${src.symbol}` },
      { k: "route", v: quote.route.label },
      {
        k: "expected",
        v: `${fmtUnits(quote.amountOut, dst.decimals)} ${dst.symbol} (${quote.slippagePct.toFixed(2)}%)`,
      },
      { k: "minReturn", v: `${fmtUnits(minReturn, dst.decimals)} ${dst.symbol}` },
    ],
  }),
};

/* -------------------------------------------------------------------------- */
/* Wrapping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The wrapped calldata, shown so an operator can read what they are about to
 * sign. Sending goes through sendRoleExecution, which encodes this again from
 * the same inner call — this is a preview, never the thing that is sent.
 */
export const docWrappedPreview = (inner: DocInner) =>
  IF.roles.encodeFunctionData("execTransactionWithRole", [
    inner.to,
    0n,
    inner.data,
    0,
    Number(DOC.ROLE),
    true,
  ]);

/** Roles v1 `execTransactionWithRole`. A different prefix means a mis-wrap. */
export const docValidateWrapped = (hex: string) =>
  typeof hex === "string" && hex.startsWith("0x6928e74b") && hex.length % 2 === 0;

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Raw eth_call over the chain's configured RPCs, same fallback rule the rest
 * of the app uses: try each until one answers, and treat a revert payload as
 * the answer rather than as a dead endpoint.
 */
const ethCall = async (
  to: string,
  data: string,
  /** Spoofed sender. Quotes come from the Safe, since it holds the tokens. */
  from?: string,
): Promise<string> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(DOC.CHAIN);
  let lastError: any;
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data, ...(from ? { from } : {}) }, "latest"],
        }),
      });
      const json = await response.json();
      if (json.error) {
        const error: any = new Error(json.error.message);
        // A revert IS the answer, so the payload rides along and the loop
        // stops rather than asking a second RPC the same question.
        error.revertData =
          typeof json.error.data === "string"
            ? json.error.data
            : json.error.data?.data;
        error.answered = error.revertData !== undefined;
        throw error;
      }
      return json.result;
    } catch (error: any) {
      if (error?.answered) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error("No Polygon RPC answered.");
};

const decodeOne = (types: string[], hex: string) =>
  ethers.AbiCoder.defaultAbiCoder().decode(types, hex);

export interface DocHolding {
  token: DocToken;
  balance: bigint;
  /** USD per whole token. Zero when no price source answered. */
  price: number;
  usd: number;
  /** Allowance granted to the 1inch router. */
  oneInchAllowance: bigint;
  /** Allowance granted to the Aave pool. DAI is the only one that can have it. */
  aaveAllowance: bigint;
}

export interface DocState {
  holdings: DocHolding[];
  /** aPolDAI held by the Safe — rebasing, so this is the DAI position itself. */
  aaveDai: bigint;
  aaveDaiUsd: number;
  /** Aave's current DAI supply rate, as a percentage. */
  aaveSupplyApr: number;
  walletUsd: number;
  totalUsd: number;
}

/** USD price with 8 decimals, from whichever source covers the asset. */
const readPrice = async (token: DocToken): Promise<number> => {
  try {
    if (token.onAave) {
      const hex = await ethCall(
        A.aaveOracle,
        IF.oracle.encodeFunctionData("getAssetPrice", [token.address]),
      );
      return Number(ethers.formatUnits(decodeOne(["uint256"], hex)[0] as bigint, 8));
    }
    // PAXG is one troy ounce of gold and is not an Aave reserve, so it is
    // priced off Chainlink's XAU/USD feed instead.
    const hex = await ethCall(A.xauFeed, IF.feed.encodeFunctionData("latestRoundData", []));
    const round = decodeOne(["uint80", "int256", "uint256", "uint256", "uint80"], hex);
    return Number(ethers.formatUnits(round[1] as bigint, 8));
  } catch {
    return 0;
  }
};

export const docReadState = async (): Promise<DocState> => {
  const balanceOf = (token: string, holder: string) =>
    ethCall(token, IF.erc20.encodeFunctionData("balanceOf", [holder])).then(
      (hex) => decodeOne(["uint256"], hex)[0] as bigint,
    );
  const allowance = (token: string, spender: string) =>
    ethCall(token, IF.erc20.encodeFunctionData("allowance", [A.safe, spender]))
      .then((hex) => decodeOne(["uint256"], hex)[0] as bigint)
      .catch(() => 0n);

  const holdings = await Promise.all(
    DOC_TOKENS.map(async (token): Promise<DocHolding> => {
      const [balance, price, oneInchAllowance, aaveAllowance] = await Promise.all([
        balanceOf(token.address, A.safe).catch(() => 0n),
        readPrice(token),
        allowance(token.address, A.oneInch),
        allowance(token.address, A.aavePool),
      ]);
      return {
        token,
        balance,
        price,
        usd: Number(ethers.formatUnits(balance, token.decimals)) * price,
        oneInchAllowance,
        aaveAllowance,
      };
    }),
  );

  const [aaveDai, reserve] = await Promise.all([
    balanceOf(A.aDai, A.safe).catch(() => 0n),
    ethCall(
      A.aavePool,
      IF.pool.encodeFunctionData("getReserveData", [DOC_TOKENS[0].address]),
    )
      .then((hex) => IF.pool.decodeFunctionResult("getReserveData", hex)[0])
      .catch(() => null),
  ]);

  const daiPrice = holdings[0]?.price ?? 0;
  const aaveDaiUsd = Number(ethers.formatUnits(aaveDai, 18)) * daiPrice;
  const walletUsd = holdings.reduce((sum, h) => sum + h.usd, 0);

  return {
    holdings,
    aaveDai,
    aaveDaiUsd,
    // A ray is 27 decimals; the rate is already an annualised fraction.
    aaveSupplyApr: reserve
      ? Number(ethers.formatUnits(reserve.currentLiquidityRate, 27)) * 100
      : 0,
    walletUsd,
    totalUsd: walletUsd + aaveDaiUsd,
  };
};

/**
 * What the Safe holds of one asset, right now. Read on its own rather than
 * through docReadState because the caller is about to sign something sized
 * against it, and the whole portfolio is a dozen calls it does not need.
 */
export const docSafeBalance = async (token: DocToken): Promise<bigint> => {
  const hex = await ethCall(
    token.address,
    IF.erc20.encodeFunctionData("balanceOf", [A.safe]),
  );
  return decodeOne(["uint256"], hex)[0] as bigint;
};

/* -------------------------------------------------------------------------- */
/* Rebalancing                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A place the portfolio's money sits. Wallet balances and the Aave deposit are
 * separate positions because they are separately targetable: moving DAI in and
 * out of Aave is a decision of its own, not a side effect of a swap.
 */
export interface DocPosition {
  key: string;
  label: string;
  token: DocToken;
  inAave: boolean;
  balance: bigint;
  price: number;
  usd: number;
  /** Share of the portfolio, 0-100. */
  weight: number;
}

export const AAVE_KEY = "AAVE_DAI";

export const docPositions = (state: DocState): DocPosition[] => {
  const total = state.totalUsd || 1;
  const dai = DOC_TOKENS[0];
  return [
    ...state.holdings.map((h) => ({
      key: h.token.symbol,
      label: h.token.symbol,
      token: h.token,
      inAave: false,
      balance: h.balance,
      price: h.price,
      usd: h.usd,
      weight: (h.usd / total) * 100,
    })),
    {
      key: AAVE_KEY,
      label: "DAI in Aave",
      token: dai,
      inAave: true,
      balance: state.aaveDai,
      price: state.holdings[0]?.price ?? 0,
      usd: state.aaveDaiUsd,
      weight: (state.aaveDaiUsd / total) * 100,
    },
  ];
};

export interface DocTrade {
  kind: "swap" | "aaveSupply" | "aaveWithdraw";
  /** Asset leaving. Undefined on an Aave withdrawal, which creates DAI. */
  sell?: DocToken;
  /** Asset arriving. Undefined on an Aave deposit, which consumes DAI. */
  buy?: DocToken;
  /** The asset `amount` is denominated in. */
  token: DocToken;
  amount: bigint;
  usd: number;
  label: string;
}

export interface DocPlan {
  trades: DocTrade[];
  /** Things the plan cannot do, said plainly rather than left to a revert. */
  issues: string[];
  /** Sum of the absolute drift being closed, in USD. */
  turnover: number;
}

/** Below this a trade is dust: gas and slippage cost more than the drift. */
export const MIN_TRADE_USD = 25;

/**
 * Turn target weights into the actual moves that reach them.
 *
 * Order matters and is baked into the result: an Aave withdrawal frees DAI
 * before the swaps that might spend it, and a deposit happens last, once the
 * swaps that fund it have landed.
 *
 * `targets` maps a position key to a percentage. Keys left out are treated as
 * "leave it where it is".
 */
export const buildRebalancePlan = (
  state: DocState,
  targets: Record<string, number>,
): DocPlan => {
  const positions = docPositions(state);
  const total = state.totalUsd;
  const issues: string[] = [];
  if (!total) return { trades: [], issues: ["The portfolio reads as empty."], turnover: 0 };

  // USD each position must gain (+) or give up (-) to hit its target.
  const deltaUsd: Record<string, number> = {};
  for (const position of positions) {
    const target = targets[position.key];
    deltaUsd[position.key] =
      target === undefined ? 0 : (target / 100) * total - position.usd;
  }

  const trades: DocTrade[] = [];
  const dai = DOC_TOKENS[0];
  const daiPrice = positions.find((p) => p.key === "DAI")?.price || 1;
  const toUnits = (usd: number, token: DocToken, price: number) =>
    ethers.parseUnits(
      Math.max(0, usd / (price || 1)).toFixed(token.decimals),
      token.decimals,
    );

  // 1 · The Aave leg. Its DAI comes from, or returns to, the wallet — so it is
  //     settled before the swap matching, and its effect is folded into what
  //     wallet DAI still has to find.
  const aaveDelta = deltaUsd[AAVE_KEY] ?? 0;
  if (Math.abs(aaveDelta) >= MIN_TRADE_USD) {
    const amount = toUnits(Math.abs(aaveDelta), dai, daiPrice);
    if (aaveDelta < 0) {
      const held = state.aaveDai;
      trades.push({
        kind: "aaveWithdraw",
        buy: dai,
        token: dai,
        amount: amount > held ? held : amount,
        usd: Math.abs(aaveDelta),
        label: `Redeem ${fmtUnits(amount > held ? held : amount, 18, 2)} DAI from Aave`,
      });
    } else {
      trades.push({
        kind: "aaveSupply",
        sell: dai,
        token: dai,
        amount,
        usd: aaveDelta,
        label: `Deposit ${fmtUnits(amount, 18, 2)} DAI into Aave`,
      });
    }
  }

  // 2 · Swaps. Wallet DAI still has to cover its own target AND whatever the
  //     Aave leg took out of it (or absorb whatever it put back).
  const swapDelta: Record<string, number> = {};
  for (const position of positions) {
    if (position.inAave) continue;
    swapDelta[position.key] =
      (deltaUsd[position.key] ?? 0) + (position.key === "DAI" ? aaveDelta : 0);
  }

  const sells = positions
    .filter((p) => !p.inAave && (swapDelta[p.key] ?? 0) < -MIN_TRADE_USD)
    .map((p) => ({ position: p, usd: -(swapDelta[p.key] ?? 0) }))
    .sort((a, b) => b.usd - a.usd);
  const buys = positions
    .filter((p) => !p.inAave && (swapDelta[p.key] ?? 0) > MIN_TRADE_USD)
    .map((p) => ({ position: p, usd: swapDelta[p.key] ?? 0 }))
    .sort((a, b) => b.usd - a.usd);

  for (const sell of sells) {
    if (sell.usd > sell.position.usd + 1) {
      issues.push(
        `The plan sells $${fmtUsd(sell.usd)} of ${sell.position.token.symbol} but the Safe only holds $${fmtUsd(sell.position.usd)}.`,
      );
    }
  }

  // Largest seller funds the largest buyer, which keeps the trade count at the
  // minimum the drift allows rather than crossing every pair.
  let si = 0;
  let bi = 0;
  while (si < sells.length && bi < buys.length) {
    const sell = sells[si];
    const buy = buys[bi];
    const usd = Math.min(sell.usd, buy.usd);
    if (usd >= MIN_TRADE_USD) {
      trades.push({
        kind: "swap",
        sell: sell.position.token,
        buy: buy.position.token,
        token: sell.position.token,
        amount: toUnits(usd, sell.position.token, sell.position.price),
        usd,
        label: `Sell $${fmtUsd(usd)} of ${sell.position.token.symbol} for ${buy.position.token.symbol}`,
      });
    }
    sell.usd -= usd;
    buy.usd -= usd;
    if (sell.usd < MIN_TRADE_USD) si++;
    if (buy.usd < MIN_TRADE_USD) bi++;
  }

  // A deposit can only be funded once the swaps that raise the DAI have run.
  trades.sort((a, b) => rank(a) - rank(b));

  return {
    trades,
    issues,
    turnover: trades.reduce((sum, t) => sum + t.usd, 0),
  };
};

const rank = (trade: DocTrade) =>
  trade.kind === "aaveWithdraw" ? 0 : trade.kind === "swap" ? 1 : 2;

/** The inner call an Aave leg turns into. A swap has to be quoted first. */
export const tradeToInner = (trade: DocTrade): DocInner | null => {
  if (trade.kind === "aaveSupply") return docInner.aaveSupply(trade.token, trade.amount);
  if (trade.kind === "aaveWithdraw") return docInner.aaveWithdraw(trade.token, trade.amount);
  return null;
};

/* -------------------------------------------------------------------------- */
/* Quoting                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What a route would actually return, asked of the chain rather than of a
 * price model: the identical swap is eth_call'd from the Safe with a floor of
 * 1, so the answer is the router's own arithmetic against live pool state.
 * A revert — no balance, no liquidity — comes back as null.
 */
export const quoteRoute = async (
  route: DocRoute,
  src: DocToken,
  amount: bigint,
): Promise<bigint | null> => {
  try {
    const result = await ethCall(
      A.oneInch,
      encodeUnoswap(route, src, amount, 1n),
      A.safe,
    );
    const out = BigInt(result);
    return out > 0n ? out : null;
  } catch {
    return null;
  }
};

/**
 * The best candidate route, decided by simulating all of them.
 *
 * This is the part that stands in for the aggregator, and the reason it can:
 * the search is small and the pools are curated, but every answer is a real
 * quote rather than an estimate. The losing candidates are exactly the traps
 * that make hand-picking a pool dangerous — DAI→WETH through the direct 0.3%
 * pool prices 47% down where the route through USDC.e prices 0.8% down.
 */
export const findBestRoute = async (
  src: DocToken,
  dst: DocToken,
  amount: bigint,
  srcPrice: number,
  dstPrice: number,
): Promise<DocQuote | null> => {
  const candidates = routeCandidates(src.symbol, dst.symbol);
  if (!candidates.length) return null;

  const quotes = await Promise.all(
    candidates.map(async (route) => ({
      route,
      amountOut: await quoteRoute(route, src, amount),
    })),
  );

  const valueIn = Number(ethers.formatUnits(amount, src.decimals)) * srcPrice;
  let best: DocQuote | null = null;
  for (const { route, amountOut } of quotes) {
    if (!amountOut) continue;
    if (best && amountOut <= best.amountOut) continue;
    const valueOut = Number(ethers.formatUnits(amountOut, dst.decimals)) * dstPrice;
    best = {
      route,
      amountIn: amount,
      amountOut,
      slippagePct: valueIn ? ((valueOut - valueIn) / valueIn) * 100 : 0,
    };
  }
  return best;
};

/**
 * A trade split into clips small enough to price well.
 *
 * Concentrated liquidity does not degrade smoothly: buying PAXG quotes within
 * half a percent up to about $2,000 and then falls off a cliff — $5,000 in one
 * clip prices 53% down. So the size is halved until a quote comes back inside
 * tolerance, and the trade goes out as that many separate swaps.
 */
/** Splitting again has to buy at least this much, or it is just more gas. */
const CLIP_GAIN_PCT = 0.25;

export const planClips = async (
  src: DocToken,
  dst: DocToken,
  total: bigint,
  srcPrice: number,
  dstPrice: number,
  maxSlippagePct: number,
  maxClips = 8,
): Promise<DocQuote[]> => {
  let best: { clips: number; quote: DocQuote } | null = null;

  for (let clips = 1; clips <= maxClips; clips *= 2) {
    const each = total / BigInt(clips);
    if (each === 0n) break;
    const quote = await findBestRoute(src, dst, each, srcPrice, dstPrice);
    if (!quote) continue;

    if (best) {
      // A thin pair is mostly paying the pools' fees, which no amount of
      // splitting removes — so stop as soon as another halving stops earning
      // its extra transaction.
      if (quote.slippagePct - best.quote.slippagePct <= CLIP_GAIN_PCT) break;
    }
    best = { clips, quote };
    if (quote.slippagePct >= -maxSlippagePct) break;
  }

  if (!best) return [];
  const { clips, quote } = best;
  const each = total / BigInt(clips);
  // The remainder rides on the last clip so the totals still add up.
  return Array.from({ length: clips }, (_, i) => ({
    ...quote,
    amountIn: i === clips - 1 ? total - each * BigInt(clips - 1) : each,
  }));
};

/** The floor to put on a quote, as base units of the bought asset. */
export const minReturnFor = (quote: DocQuote, tolerancePct: number) =>
  (quote.amountOut * BigInt(Math.round((100 - tolerancePct) * 100))) / 10000n;

/* -------------------------------------------------------------------------- */
/* The whitelist grant                                                        */
/* -------------------------------------------------------------------------- */

/**
 * "granted"     — role 1 may call unoswapTo and unoswapTo2 exactly as the
 *                 proposal scopes them;
 * "different"   — the entry points are scoped, but not to these rules, so
 *                 the console must not build calls the modifier would refuse;
 * "missing"     — not scoped at all: the proposal has not executed;
 * "unreachable" — the modifier's log could not be read from any source.
 */
export type DocGrantState = "granted" | "different" | "missing" | "unreachable";

const sameSet = (a: string[], b: string[]) => {
  const left = [...new Set(a.map((x) => x.toLowerCase()))].sort();
  const right = [...new Set(b.map((x) => x.toLowerCase()))].sort();
  return left.length === right.length && left.every((x, i) => x === right[i]);
};

/**
 * Reads the modifier's event log (explorer → Blockscout → RPCs) and compares
 * role 1's scope for the two entry points with DOC_UNOSWAP_RULES.
 */
export const readDocUnoswapGrant = async (): Promise<DocGrantState> => {
  let modifier;
  try {
    modifier = await fetchOnChainRolesV1(DOC.CHAIN, A.roles);
  } catch (error) {
    console.warn("Could not read the DoC modifier", error);
    return "unreachable";
  }
  const role = modifier?.roles.find((r) => String(r.name) === DOC.ROLE);
  const target = role?.targets.find((t) => t.address.toLowerCase() === A.oneInch.toLowerCase());
  if (!role || !target) return "missing";

  const rules = DOC_UNOSWAP_RULES;
  const check = (
    selector: string,
    dexSlots: { index: number; words: bigint[] }[],
  ): DocGrantState => {
    const fn = target.functions.find((f) => f.sighash.toLowerCase() === selector.toLowerCase());
    if (!fn) return "missing";
    if (fn.wildcarded) return "different";
    const param = (index: number) => fn.parameters.find((p) => Number(p.index) === index);
    const to = param(0);
    if (!to || to.comparison !== ParamComparison.EQUAL_TO || !sameSet(to.comparisonValue, [rules.safeWord])) {
      return "different";
    }
    const token = param(1);
    if (!token || token.comparison !== ParamComparison.ONE_OF || !sameSet(token.comparisonValue, rules.tokenWords)) {
      return "different";
    }
    for (const slot of dexSlots) {
      const dex = param(slot.index);
      if (!dex || dex.comparison !== ParamComparison.ONE_OF || !sameSet(dex.comparisonValue, slot.words.map(wordHex))) {
        return "different";
      }
    }
    return "granted";
  };

  const states = [
    check(UNOSWAP_TO_SELECTOR, [{ index: 4, words: rules.directWords }]),
    check(UNOSWAP_TO2_SELECTOR, [
      { index: 4, words: rules.firstHopWords },
      { index: 5, words: rules.secondHopWords },
    ]),
  ];
  if (states.every((s) => s === "granted")) return "granted";
  if (states.every((s) => s === "missing")) return "missing";
  return "different";
};
