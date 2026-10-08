import { ethers } from "ethers";
import {
  UNOSWAP_TO2_SELECTOR,
  UNOSWAP_TO_SELECTOR,
  allowedDexWords,
  wordHex,
  type AllowedPool,
  type UnoswapCalldata,
  type UnoswapRoute,
  type UnoswapRules,
} from "./onchainSwap";
import {
  ONE_INCH_ROUTER_V6,
  shortAddress,
  type OneInchSwapRules,
  type SwapAsset,
} from "./oneInchSwap";
import { ethCallOn } from "./rpc";
import { fetchOnChainRolesV1 } from "~/services/onchain/rolesV1";
import { ParamComparison } from "~/types/enums/zodiac-roles";
import { ChainId } from "~/types/enums/chain_id";

/**
 * INDEFI execution console — addresses, whitelist facts and calldata builders.
 *
 * The vault runs Zodiac Roles **v1** on Base and its manager role is role 1.
 * Everything below was read off the modifier's own event log (54 events,
 * blocks 22,306,821 → 36,999,770) — what the live modifier enforces, not what
 * the setup intended.
 *
 * The whitelist today, as far as trading goes:
 *
 *   1inch AggregationRouterV6 — `swap` (0x07ed2379) ONLY
 *     · desc.dstToken one-of WETH, USDC, AERO (and, by a setup slip, the old
 *       Slipstream position manager); desc.dstReceiver pinned to the Safe;
 *       srcToken, amount, minReturn, EXECUTOR and flags unconstrained.
 *     · every other selector, `unoswapTo` included, → FunctionNotAllowed
 *
 *   ERC-20 approve — USDC, WETH, AERO each one-of {1inch router, the two
 *     Aerodrome Slipstream position managers}; all three already unlimited
 *     for the router.
 *
 * Why swapping needs a whitelist change: `swap()` hands the trade to any
 * executor contract the caller names and runs a routing program only the
 * 1inch API writes — the 1inch web app can no longer be made to produce it,
 * and the free executor slot lets a compromised manager key take everything
 * for a wei. The governance proposal in indefiProposal.ts therefore scopes
 * `unoswapTo` / `unoswapTo2` instead — proceeds pinned to the Safe, sold token
 * one-of the vault's assets, pools one-of INDEFI_POOLS below — and revokes
 * `swap()`. The console builds those calls itself; see onchainSwap.ts.
 */

export const INDEFI = {
  CHAIN: ChainId.BASE,
  EXPLORER: "https://basescan.org",
  /** Roles v1 manager role. The modifier takes it as a uint16. */
  ROLE: "1",
  ADDR: {
    fund: "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4",
    safe: "0x6B6d690F540788b87FC63BD975e6B398da775159",
    roles: "0x89de956576ACc0a141Bef842A489C2C391382B81",
    oneInch: ONE_INCH_ROUTER_V6,
  },
};

export interface IndefiToken extends SwapAsset {
  /** Chainlink USD feed on Base, 8 decimals. */
  feed: string;
}

/**
 * The assets the console trades. Every one can be sold (approved to the
 * router) and bought (one-of `desc.dstToken`), so any pair goes either way.
 */
export const INDEFI_TOKENS: IndefiToken[] = [
  {
    symbol: "USDC",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    feed: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
  },
  {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    feed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
  },
  {
    symbol: "AERO",
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    decimals: 18,
    feed: "0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0",
  },
];

export const indefiToken = (address: string): IndefiToken | undefined =>
  INDEFI_TOKENS.find((t) => t.address.toLowerCase() === (address || "").toLowerCase());

/** What the modifier pins on `swap()` today, for the generic validator. */
export const INDEFI_SWAP_RULES: OneInchSwapRules = {
  safe: INDEFI.ADDR.safe,
  permittedDst: INDEFI_TOKENS,
};

const tokenBySymbol = (symbol: string): IndefiToken =>
  INDEFI_TOKENS.find((t) => t.symbol === symbol)!;

/**
 * The pools the vault may trade through — the whitelist proposal scopes
 * exactly these (both directions of each), and the console routes only
 * through them. All canonical Uniswap V3 pools on Base: the router's
 * `unoswap` path verifies a pool's swap callback against Uniswap's factory,
 * so Aerodrome's pools cannot be used here even if listed. Rehearsed on a
 * fork in contracts/indefi-unoswap-whitelist.
 *
 * Deepest per pair only. Adding a pool later means another proposal, on
 * purpose: the list is the security boundary.
 */
export const INDEFI_POOLS: AllowedPool[] = [
  { address: "0xb4CB800910B228ED3d0834cF79D697127BBB00e5", tokens: [tokenBySymbol("USDC"), tokenBySymbol("WETH")], label: "Uniswap V3 USDC/WETH 0.01%" },
  { address: "0xd0b53D9277642d899DF5C87A3966A349A798F224", tokens: [tokenBySymbol("USDC"), tokenBySymbol("WETH")], label: "Uniswap V3 USDC/WETH 0.05%" },
  { address: "0x6c561B446416E1A00E8E93E221854d6eA4171372", tokens: [tokenBySymbol("USDC"), tokenBySymbol("WETH")], label: "Uniswap V3 USDC/WETH 0.30%" },
  { address: "0x3d5D143381916280ff91407FeBEB52f2b60f33Cf", tokens: [tokenBySymbol("AERO"), tokenBySymbol("WETH")], label: "Uniswap V3 AERO/WETH 0.30%" },
  { address: "0xE5B5f522E98B5a2baAe212d4dA66b865B781DB97", tokens: [tokenBySymbol("AERO"), tokenBySymbol("USDC")], label: "Uniswap V3 AERO/USDC 0.05%" },
];

/** What the proposal pins on `unoswapTo` / `unoswapTo2`, for the validator. */
export const INDEFI_UNOSWAP_RULES: UnoswapRules = {
  safe: INDEFI.ADDR.safe,
  sellable: INDEFI_TOKENS,
  dexWords: allowedDexWords(INDEFI_POOLS),
};

const A = INDEFI.ADDR;
const MAX_UINT256 = (1n << 256n) - 1n;

const IF = {
  erc20: new ethers.Interface([
    "function approve(address spender,uint256 amount)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ]),
  roles: new ethers.Interface([
    "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,uint16 role,bool shouldRevert) returns (bool)",
  ]),
  feed: new ethers.Interface([
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ]),
};

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

export interface IndefiParam {
  k: string;
  v: string;
  /** Fixed by the whitelist: any other value is a permission denial. */
  pinned?: boolean;
}

export interface IndefiInner {
  to: string;
  data: string;
  sig: string;
  params: IndefiParam[];
}

export const indefiInner = {
  approve: (token: IndefiToken): IndefiInner => ({
    to: token.address,
    data: IF.erc20.encodeFunctionData("approve", [A.oneInch, MAX_UINT256]),
    sig: `${token.symbol}.approve(spender, amount)`,
    params: [
      { k: "spender", v: `1inch router ${shortAddress(A.oneInch)}`, pinned: true },
      { k: "amount", v: "uint256.max (unlimited)" },
    ],
  }),

  /** The router call a quoted route becomes, with every argument readable. */
  unoswap: (
    call: UnoswapCalldata,
    hex: string,
    route: UnoswapRoute,
    src: SwapAsset,
    dst: SwapAsset,
  ): IndefiInner => ({
    to: A.oneInch,
    data: hex.trim(),
    sig:
      route.hops.length === 1
        ? "AggregationRouterV6.unoswapTo(to, token, amount, minReturn, dex)"
        : "AggregationRouterV6.unoswapTo2(to, token, amount, minReturn, dex, dex2)",
    params: [
      { k: "to", v: `Safe ${shortAddress(A.safe)}`, pinned: true },
      { k: "sell", v: `${fmtUnits(call.amount, src.decimals, 6)} ${src.symbol}` },
      { k: "route", v: route.label, pinned: true },
      { k: "minReturn", v: `${fmtUnits(call.minReturn, dst.decimals, 6)} ${dst.symbol}` },
    ],
  }),
};

/**
 * The wrapped calldata, shown so an operator can read what they are about to
 * sign. Sending goes through the curator layer, which encodes this again from
 * the same inner call — this is a preview, never the thing that is sent.
 */
export const indefiWrappedPreview = (inner: IndefiInner) =>
  IF.roles.encodeFunctionData("execTransactionWithRole", [
    inner.to,
    0n,
    inner.data,
    0,
    Number(INDEFI.ROLE),
    true,
  ]);

/** Roles v1 `execTransactionWithRole`. A different prefix means a mis-wrap. */
export const indefiValidateWrapped = (hex: string) =>
  typeof hex === "string" && hex.startsWith("0x6928e74b") && hex.length % 2 === 0;

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

const decodeOne = (types: string[], hex: string) =>
  ethers.AbiCoder.defaultAbiCoder().decode(types, hex);

export interface IndefiHolding {
  token: IndefiToken;
  balance: bigint;
  /** USD per whole token from Chainlink. Zero when the feed did not answer. */
  price: number;
  usd: number;
  /** Allowance granted to the 1inch router. */
  oneInchAllowance: bigint;
}

export interface IndefiState {
  holdings: IndefiHolding[];
  totalUsd: number;
}

/** USD price with 8 decimals, from the token's Chainlink feed. */
export const indefiReadPrice = async (token: IndefiToken): Promise<number> => {
  try {
    const hex = await ethCallOn(
      INDEFI.CHAIN,
      token.feed,
      IF.feed.encodeFunctionData("latestRoundData", []),
    );
    const round = decodeOne(["uint80", "int256", "uint256", "uint256", "uint80"], hex);
    return Number(ethers.formatUnits(round[1] as bigint, 8));
  } catch {
    return 0;
  }
};

/** What the Safe holds of one asset, right now. */
export const indefiSafeBalance = async (token: IndefiToken): Promise<bigint> => {
  const hex = await ethCallOn(
    INDEFI.CHAIN,
    token.address,
    IF.erc20.encodeFunctionData("balanceOf", [A.safe]),
  );
  return decodeOne(["uint256"], hex)[0] as bigint;
};

export const indefiReadState = async (): Promise<IndefiState> => {
  const allowance = (token: IndefiToken) =>
    ethCallOn(
      INDEFI.CHAIN,
      token.address,
      IF.erc20.encodeFunctionData("allowance", [A.safe, A.oneInch]),
    )
      .then((hex) => decodeOne(["uint256"], hex)[0] as bigint)
      .catch(() => 0n);

  const holdings = await Promise.all(
    INDEFI_TOKENS.map(async (token): Promise<IndefiHolding> => {
      const [balance, price, oneInchAllowance] = await Promise.all([
        indefiSafeBalance(token).catch(() => 0n),
        indefiReadPrice(token),
        allowance(token),
      ]);
      return {
        token,
        balance,
        price,
        usd: Number(ethers.formatUnits(balance, token.decimals)) * price,
        oneInchAllowance,
      };
    }),
  );

  return {
    holdings,
    totalUsd: holdings.reduce((sum, h) => sum + h.usd, 0),
  };
};

/* -------------------------------------------------------------------------- */
/* Is the whitelist in place?                                                  */
/* -------------------------------------------------------------------------- */

/**
 * "granted"   — role 1 may call unoswapTo and unoswapTo2 exactly as the
 *               proposal scopes them (receiver pinned, tokens and pools
 *               one-of the console's lists);
 * "different" — the entry points are scoped, but not to these rules, so the
 *               console must not build calls the modifier would refuse;
 * "missing"   — not scoped at all: the proposal has not executed;
 * "unreachable" — the modifier's log could not be read from any source.
 */
export type UnoswapGrantState = "granted" | "different" | "missing" | "unreachable";

const sameSet = (a: string[], b: string[]) => {
  const left = [...new Set(a.map((x) => x.toLowerCase()))].sort();
  const right = [...new Set(b.map((x) => x.toLowerCase()))].sort();
  return left.length === right.length && left.every((x, i) => x === right[i]);
};

/**
 * Reads the modifier's event log (explorer → Blockscout → RPCs) and compares
 * role 1's scope for the two entry points with INDEFI_UNOSWAP_RULES.
 */
export const readIndefiUnoswapGrant = async (): Promise<UnoswapGrantState> => {
  let modifier;
  try {
    modifier = await fetchOnChainRolesV1(INDEFI.CHAIN, INDEFI.ADDR.roles);
  } catch (error) {
    console.warn("Could not read the INDEFI modifier", error);
    return "unreachable";
  }
  const role = modifier?.roles.find((r) => String(r.name) === INDEFI.ROLE);
  const target = role?.targets.find(
    (t) => t.address.toLowerCase() === INDEFI.ADDR.oneInch.toLowerCase(),
  );
  if (!role || !target) return "missing";

  const safeWord = wordHex(INDEFI.ADDR.safe).toLowerCase();
  const tokenWords = INDEFI_TOKENS.map((t) => wordHex(t.address));
  const poolWords = INDEFI_UNOSWAP_RULES.dexWords.map(wordHex);

  const check = (selector: string, dexIndexes: number[]): UnoswapGrantState => {
    const fn = target.functions.find((f) => f.sighash.toLowerCase() === selector.toLowerCase());
    if (!fn) return "missing";
    if (fn.wildcarded) return "different";
    const param = (index: number) => fn.parameters.find((p) => Number(p.index) === index);
    const to = param(0);
    if (
      !to ||
      to.comparison !== ParamComparison.EQUAL_TO ||
      to.comparisonValue.map((v) => v.toLowerCase())[0] !== safeWord
    ) {
      return "different";
    }
    const token = param(1);
    if (!token || token.comparison !== ParamComparison.ONE_OF || !sameSet(token.comparisonValue, tokenWords)) {
      return "different";
    }
    for (const index of dexIndexes) {
      const dex = param(index);
      if (!dex || dex.comparison !== ParamComparison.ONE_OF || !sameSet(dex.comparisonValue, poolWords)) {
        return "different";
      }
    }
    return "granted";
  };

  const states = [check(UNOSWAP_TO_SELECTOR, [4]), check(UNOSWAP_TO2_SELECTOR, [4, 5])];
  if (states.every((s) => s === "granted")) return "granted";
  if (states.every((s) => s === "missing")) return "missing";
  return "different";
};
