import { ethers } from "ethers";
import {
  ONE_INCH_ROUTER_V6,
  shortAddress,
  type OneInchSwapCalldata,
  type OneInchSwapRules,
  type SwapAsset,
} from "./oneInchSwap";
import { ethCallOn } from "./rpc";
import { ChainId } from "~/types/enums/chain_id";

/**
 * INDEFI execution console — addresses, whitelist facts and calldata builders.
 *
 * The vault runs Zodiac Roles **v1** on Base and its manager role is role 1.
 * Everything below was read off the modifier's own event log (54 events,
 * blocks 22,306,821 → 36,999,770) — what the live modifier enforces, not what
 * the setup intended.
 *
 * The whitelist, as far as trading goes:
 *
 *   1inch AggregationRouterV6 — `swap` (0x07ed2379) ONLY
 *     · desc.dstToken   (word 2) one-of WETH, USDC, AERO (and, by a setup
 *                       slip, the old Slipstream position manager — which can
 *                       never be a token)
 *     · desc.dstReceiver(word 4) pinned to the Safe
 *     · srcToken, amount, minReturn, executor, flags: unconstrained
 *     · msg.value must be 0 (options None)
 *     · every other selector, `unoswap*` included, → FunctionNotAllowed
 *
 *   ERC-20 approve — USDC, WETH, AERO each one-of {1inch router, the two
 *     Aerodrome Slipstream position managers}; all three already sit at an
 *     unlimited allowance for the router.
 *
 *   The rest is Aerodrome LP management (position managers, the WETH/USDC
 *   gauge), the NAV executor, the vault's flows call and USDC → vault
 *   transfers; none of it is offered here.
 *
 * Why swapping needs a console at all: the pathfinder decides which router
 * entry point a trade gets, and for a single-pool route that is `unoswap`,
 * which the modifier refuses. The 1inch web app lost the switch that forced
 * `swap` in September 2026, so the manager could not buy WETH with the vault's
 * USDC. The route is now built through the backend's 1inch relay in
 * compatibility mode — `swap()` every time — and sent through the modifier
 * from the manager's wallet, or unwrapped from the Safe itself.
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

/** What the modifier pins on `swap()`, for the generic validator. */
export const INDEFI_SWAP_RULES: OneInchSwapRules = {
  safe: INDEFI.ADDR.safe,
  permittedDst: INDEFI_TOKENS,
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

  /**
   * The step a built or pasted `swap()` becomes. The program is passed
   * through byte for byte — it is a signed-off artefact of the router's own
   * pathfinder, and editing any of it would only make the swap fail in the
   * executor.
   */
  swap: (
    call: OneInchSwapCalldata,
    hex: string,
    src: SwapAsset,
    dst: SwapAsset,
    route = "",
  ): IndefiInner => ({
    to: A.oneInch,
    data: hex.trim(),
    sig: "AggregationRouterV6.swap(executor, desc, data)",
    params: [
      { k: "sell", v: `${fmtUnits(call.amount, src.decimals, 6)} ${src.symbol}` },
      { k: "buy", v: dst.symbol },
      { k: "dstReceiver", v: `Safe ${shortAddress(A.safe)}`, pinned: true },
      { k: "minReturn", v: `${fmtUnits(call.minReturn, dst.decimals, 6)} ${dst.symbol}` },
      { k: "executor", v: shortAddress(call.executor) },
      {
        k: "route",
        v: route || `1inch program, ${(call.program.length - 2) / 2} bytes`,
      },
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
