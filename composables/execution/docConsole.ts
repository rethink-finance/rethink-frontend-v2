import { ethers } from "ethers";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ChainId } from "~/types/enums/chain_id";

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
 *   1inch AggregationRouterV6 — `swap` (0x07ed2379) ONLY
 *     · desc.dstToken   (word 2) one-of the six supported assets
 *     · desc.dstReceiver(word 4) pinned to the Safe
 *     · srcToken, amount, minReturn, executor: unconstrained
 *     · msg.value must be 0 (options None → SendNotAllowed)
 *     · every other selector, `unoswap` included, → FunctionNotAllowed
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

export const DOC = {
  CHAIN: ChainId.POLYGON,
  EXPLORER: "https://polygonscan.com",
  /** Roles v1 manager role. The modifier takes it as a uint16. */
  ROLE: "1",
  ADDR: {
    fund: "0xBE0B0C435EA1156F76d3E116Fbd5606743ab179a",
    safe: "0xfcF577A1b4364a55Af6C48804C8fF4a8463d7dC0",
    roles: "0x04B0B7318c6e6F081E5a57D1A2e415cB5dcbe19F",
    oneInch: "0x111111125421cA6dc452d289314280a0f8842A65",
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    /** Aave's own oracle: USD with 8 decimals for every reserve it lists. */
    aaveOracle: "0xb023e699F5a33916Ea823A16485e259257cA8Bd1",
    /** aPolDAI — rebasing, so its balance IS the DAI position. */
    aDai: "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
    /** PAXG is not an Aave reserve, so its price comes from XAU/USD. */
    xauFeed: "0x0C466540B2ee1a31b441671eac0ca886e051E410",
  },
  /** The only 1inch selector role 1 may call. */
  /** The selector role 1 was originally scoped for. Kept for reference: it is
   *  the aggregator path, and needs a solver-built routing blob. */
  SWAP_SELECTOR: "0x07ed2379",
};

export interface DocToken {
  symbol: string;
  address: string;
  decimals: number;
  /** May be sold: role 1 can approve it to the 1inch router. */
  sellable: boolean;
  /** May be bought: it is one of the whitelisted `desc.dstToken` values. */
  buyable: boolean;
  /** Aave reserve — priced by Aave's oracle rather than the XAU feed. */
  onAave: boolean;
}

/**
 * The assets this console manages.
 *
 * The vault's whitelist also permits buying WPOL and USDC.e, but neither can
 * ever be sold again — role 1 holds no approval for either — so a rebalancer
 * that offered them would be offering a one-way door. They are left out on
 * purpose. USDC.e still appears below as a routing hop, which is a different
 * thing: an intermediate leg settles inside the same transaction and is never
 * a position the vault holds.
 */
export const DOC_TOKENS: DocToken[] = [
  { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18, sellable: true, buyable: true, onAave: true },
  { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18, sellable: true, buyable: true, onAave: true },
  { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8, sellable: true, buyable: true, onAave: true },
  { symbol: "PAXG", address: "0x553d3D295e0f695B9228246232eDF400ed3560B5", decimals: 18, sellable: true, buyable: true, onAave: false },
];

export const docToken = (address: string): DocToken | undefined =>
  DOC_TOKENS.find((t) => t.address.toLowerCase() === (address || "").toLowerCase());

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
  router: new ethers.Interface([
    // Quote-only. `unoswap*` is not on role 1's whitelist, but eth_call from
    // the Safe does not go through the modifier, so these still price a route.
    "function unoswapTo(uint256 to,uint256 token,uint256 amount,uint256 minReturn,uint256 dex) returns (uint256 returnAmount)",
    "function unoswapTo2(uint256 to,uint256 token,uint256 amount,uint256 minReturn,uint256 dex,uint256 dex2) returns (uint256 returnAmount)",
    // The one selector role 1 may actually send.
    "function swap(address executor,(address srcToken,address dstToken,address srcReceiver,address dstReceiver,uint256 amount,uint256 minReturnAmount,uint256 flags) desc,bytes data) payable returns (uint256 returnAmount,uint256 spentAmount)",
  ]),
};

export const shortAddr = (a?: string) =>
  a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";

/** Money for reading, never for maths — the bigint stays the source of truth. */
export const fmtUnits = (v: bigint, decimals: number, dp = 4) =>
  Number(ethers.formatUnits(v ?? 0n, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  });

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

/**
 * A route and its price, declared here because the calldata builder below
 * takes one. The machinery that finds and quotes them is further down, under
 * "Direct-pool routing".
 */
export interface DocPool {
  a: string;
  b: string;
  fee: number;
  address: string;
}

export interface DocRouteHop {
  pool: DocPool;
  sell: string;
  buy: string;
}

export interface DocRoute {
  hops: DocRouteHop[];
  /** Human reading of the path, e.g. "PAXG → USDC (0.30%) → WBTC (0.30%)". */
  label: string;
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
/* Direct-pool routing                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The 1inch router's `unoswap*` family takes the pools to trade through as
 * plain numbers, so a route can be built here rather than fetched from the
 * aggregator's solver. That is the whole reason this console needs no API key:
 * `swap()` carries an opaque, expiring, signed routing program, while
 * `unoswapTo(to, token, amount, minReturn, dex)` carries a pool address and
 * two flag bits.
 *
 * A "dex word" is a uint256 — the protocol in the top bits, a direction flag,
 * and the pool address in the low 160:
 *
 *   bit 253  Uniswap V3 (protocol 1)
 *   bit 247  zeroForOne — set when the token being sold is the pool's token0
 *
 * Uniswap V3 always orders a pool's tokens by address, so direction follows
 * from comparing the two addresses and nothing has to be read on chain. Same
 * encoding the sni-dca keeper runs on, re-verified here by quoting every pair.
 */
const UNISWAP_V3_FLAG = 1n << 253n;
const ZERO_FOR_ONE_FLAG = 1n << 247n;

export const dexWord = (pool: string, sellToken: string, buyToken: string) => {
  const zeroForOne = sellToken.toLowerCase() < buyToken.toLowerCase();
  return UNISWAP_V3_FLAG | (zeroForOne ? ZERO_FOR_ONE_FLAG : 0n) | BigInt(pool);
};

/**
 * Tokens the console may route THROUGH without the vault holding them. Both
 * are dollar-pegged, and both legs settle in one transaction, so an
 * intermediate leg never leaves the vault exposed to it.
 */
export const HOP_TOKENS: Record<string, string> = {
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  "USDC.e": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
};

const addressOf = (symbol: string) =>
  DOC_TOKENS.find((t) => t.symbol === symbol)?.address ?? HOP_TOKENS[symbol] ?? "";

/**
 * The pools this console will trade through — swept from the Uniswap V3
 * factory, then filtered by what a quote actually returned at a $5,000 clip.
 * The shallow duplicates that priced 20-50% worse were dropped rather than
 * left in as candidates. Route choice still quotes every remaining candidate
 * on chain; this list only bounds where the money is allowed to go.
 */
export const DOC_POOLS: DocPool[] = [
  { a: "DAI", b: "USDC.e", fee: 100, address: "0x5645dCB64c059aa11212707fbf4E7F984440a8Cf" },
  { a: "DAI", b: "USDC", fee: 100, address: "0xf369277650aD6654f25412ea8BFBD5942733BaBC" },
  { a: "DAI", b: "WETH", fee: 3000, address: "0x6baD0f9a89Ca403bb91d253D385CeC1A2b6eca97" },
  { a: "WETH", b: "USDC", fee: 500, address: "0xA4D8c89f0c20efbe54cBa9e7e7a7E509056228D9" },
  { a: "WETH", b: "USDC.e", fee: 500, address: "0x45dDa9cb7c25131DF268515131f647d726f50608" },
  { a: "WETH", b: "WBTC", fee: 500, address: "0x50eaEDB835021E4A108B7290636d62E9765cc6d7" },
  { a: "WETH", b: "PAXG", fee: 10000, address: "0x0B1510C24Cf377A08258bc01DFBBc40035Ee3653" },
  { a: "WBTC", b: "USDC.e", fee: 500, address: "0xeEF1A9507B3D505f0062f2be9453981255b503c8" },
  { a: "WBTC", b: "USDC", fee: 3000, address: "0xe6Ba22265AeFe9dC392F544437ACCe2AEdF8ef36" },
  { a: "WBTC", b: "USDC", fee: 500, address: "0x32FAE204835e08b9374493d6B4628FD1F87DD045" },
  { a: "WBTC", b: "PAXG", fee: 3000, address: "0xe9Cb1Ea03C1F9643df263944f7CB3782E0C78312" },
  { a: "PAXG", b: "USDC", fee: 3000, address: "0x2773d038a811e4C3591c76610aF22A98Fd1fccC3" },
  { a: "PAXG", b: "USDC.e", fee: 3000, address: "0xcCA15D926B707119F6B74B559DF3aaeCc14f2D88" },
  { a: "USDC.e", b: "USDC", fee: 100, address: "0xD36ec33c8bed5a9F7B6630855f1533455b98a418" },
];

const poolsBetween = (x: string, y: string) =>
  DOC_POOLS.filter((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));

const routeLabel = (src: string, hops: DocRouteHop[]) =>
  hops.reduce(
    (text, h) => `${text} → ${h.buy} (${(h.pool.fee / 10000).toFixed(2)}%)`,
    src,
  );

/**
 * Every path from `src` to `dst` worth considering: the direct pools, then one
 * hop through a dollar-pegged intermediate. Two hops is the ceiling because
 * `unoswapTo2` is the widest variant being permitted — and because on these
 * assets a third hop never won a quote.
 */
export const routeCandidates = (src: string, dst: string): DocRoute[] => {
  const out: DocRoute[] = [];
  for (const pool of poolsBetween(src, dst)) {
    const hops = [{ pool, sell: src, buy: dst }];
    out.push({ hops, label: routeLabel(src, hops) });
  }
  for (const mid of Object.keys(HOP_TOKENS)) {
    if (mid === src || mid === dst) continue;
    for (const first of poolsBetween(src, mid)) {
      for (const second of poolsBetween(mid, dst)) {
        const hops = [
          { pool: first, sell: src, buy: mid },
          { pool: second, sell: mid, buy: dst },
        ];
        out.push({ hops, label: routeLabel(src, hops) });
      }
    }
  }
  return out;
};

/** The router call a route turns into, before it is wrapped for the modifier. */
export const encodeUnoswap = (
  route: DocRoute,
  src: DocToken,
  amount: bigint,
  minReturn: bigint,
) => {
  const words = route.hops.map((h) =>
    dexWord(h.pool.address, addressOf(h.sell), addressOf(h.buy)),
  );
  const head = [BigInt(A.safe), BigInt(src.address), amount, minReturn];
  return words.length === 1
    ? IF.router.encodeFunctionData("unoswapTo", [...head, words[0]])
    : IF.router.encodeFunctionData("unoswapTo2", [...head, words[0], words[1]]);
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
/* The one selector role 1 may send                                           */
/* -------------------------------------------------------------------------- */

/**
 * `swap` is the only entry point on the router role 1 may call, and its
 * routing program is written by 1inch's pathfinder. That program cannot be
 * generated here, and the vault's own history is not a template library
 * either: of the 47 swaps this Safe has executed, 40 no longer execute at all
 * against current pool state and only 3 survive a change of size.
 *
 * What the permission leaves open is everything except the destination —
 * `srcToken`, `amount`, `minReturn`, `executor` and the program itself are
 * unconstrained; `desc.dstToken` must be one of the six assets and
 * `desc.dstReceiver` must be the Safe. So a program built anywhere executes
 * here, which is exactly what Zodiac Pilot exploited: it captured what the
 * 1inch dApp would have sent from the Safe and replayed it through the
 * modifier. These helpers do the same thing without the extension — take that
 * calldata, prove it matches both the permission and the leg it is meant to
 * fill, and hand it to the modifier.
 */

export interface DocSwapCalldata {
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

/** What a leg of the plan expects the pasted calldata to do. */
export interface DocSwapIntent {
  sell: DocToken;
  buy: DocToken;
  amount: bigint;
}

export const parseDocSwap = (hex: string): DocSwapCalldata => {
  const data = (hex ?? "").trim();
  if (!/^0x[0-9a-fA-F]*$/.test(data)) throw new Error("That is not hex calldata.");
  if (!data.toLowerCase().startsWith(DOC.SWAP_SELECTOR)) {
    throw new Error(
      `Wrong entry point: this calldata starts ${data.slice(0, 10)}, and role 1 may only call swap (${DOC.SWAP_SELECTOR}). ` +
        "An unoswap or a permit2 variant will be refused by the modifier.",
    );
  }
  let decoded;
  try {
    decoded = IF.router.decodeFunctionData("swap", data);
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

/** Assets the modifier will accept as `desc.dstToken`, from its own log. */
const PERMITTED_DST = [
  ...DOC_TOKENS.map((t) => t.address),
  HOP_TOKENS["USDC.e"],
  "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WPOL — buyable, never sellable
];

/**
 * Everything that would make the modifier reject this, said before the wallet
 * opens rather than as an opaque revert after signing. The first three are the
 * permission itself; the rest are the difference between valid calldata and
 * the calldata for THIS leg.
 */
export const validateDocSwap = (
  call: DocSwapCalldata,
  intent: DocSwapIntent,
): string[] => {
  const problems: string[] = [];
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  if (!PERMITTED_DST.some((a) => same(a, call.dstToken))) {
    problems.push(
      `The modifier only allows buying the six whitelisted assets, and this buys ${shortAddr(call.dstToken)}.`,
    );
  }
  if (!same(call.dstReceiver, A.safe)) {
    problems.push(
      `Proceeds must land in the Safe. This sends them to ${shortAddr(call.dstReceiver)} — set the receiver to ${shortAddr(A.safe)} when you build the swap.`,
    );
  }
  if (!same(call.srcToken, intent.sell.address)) {
    problems.push(
      `This leg sells ${intent.sell.symbol}, but the calldata sells ${docToken(call.srcToken)?.symbol ?? shortAddr(call.srcToken)}.`,
    );
  }
  if (!same(call.dstToken, intent.buy.address)) {
    problems.push(
      `This leg buys ${intent.buy.symbol}, but the calldata buys ${docToken(call.dstToken)?.symbol ?? shortAddr(call.dstToken)}.`,
    );
  }
  // A pathfinder quote is taken at a round number, so an exact match is too
  // strict; a leg that is materially the wrong size is not.
  if (intent.amount > 0n) {
    const drift =
      Number((call.amount * 10000n) / intent.amount) / 10000 - 1;
    if (Math.abs(drift) > 0.02) {
      problems.push(
        `This leg sells ${fmtUnits(intent.amount, intent.sell.decimals)} ${intent.sell.symbol}, ` +
          `but the calldata sells ${fmtUnits(call.amount, intent.sell.decimals)} — ${(drift * 100).toFixed(1)}% off.`,
      );
    }
  }
  if (call.minReturn === 0n) {
    problems.push(
      "minReturn is zero, so this would accept any fill at all. Rebuild the swap with a slippage limit.",
    );
  }
  return problems;
};

/**
 * The step this calldata becomes. The program is passed through byte for byte
 * — it is a signed-off artefact from the router's own pathfinder, and editing
 * any of it would only make the swap fail in the executor.
 */
export const docOneInchSwap = (
  call: DocSwapCalldata,
  hex: string,
  src: DocToken,
  dst: DocToken,
): DocInner => ({
  to: A.oneInch,
  data: hex.trim(),
  sig: "AggregationRouterV6.swap(executor, desc, data)",
  params: [
    { k: "sell", v: `${fmtUnits(call.amount, src.decimals)} ${src.symbol}` },
    { k: "buy", v: dst.symbol },
    { k: "dstReceiver", v: `Safe ${shortAddr(A.safe)}`, pinned: true },
    { k: "minReturn", v: `${fmtUnits(call.minReturn, dst.decimals)} ${dst.symbol}` },
    { k: "executor", v: shortAddr(call.executor) },
    { k: "route", v: `1inch program, ${(call.program.length - 2) / 2} bytes` },
  ],
});
