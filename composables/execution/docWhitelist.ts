import { ethers } from "ethers";
import { parseUnoswap, unoswapInterface, wordHex, type UnoswapCalldata } from "./onchainSwap";
import { ChainId } from "~/types/enums/chain_id";

/**
 * DoC Treasury Protection — the facts the console, the whitelist proposal
 * and the rehearsal script all build on, kept free of app stores so a node
 * script can import them: the addresses, the assets, the pools, how a route
 * becomes an `unoswapTo` call, and what the whitelist allows.
 *
 * The console (docConsole.ts) adds the state reads, the quoting and the
 * on-chain grant check on top; the proposal (docProposal.ts) turns the rules
 * below into the governor's calls.
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
 * The vault's original whitelist also permitted buying WPOL and USDC.e, but
 * neither can ever be sold again — role 1 holds no approval for either — so a
 * rebalancer that offered them would be offering a one-way door. They are
 * left out on purpose. USDC and USDC.e still appear below as routing hops,
 * which is a different thing: an intermediate leg settles inside the same
 * transaction and is never a position the vault holds.
 */
export const DOC_TOKENS: DocToken[] = [
  { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18, sellable: true, buyable: true, onAave: true },
  { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18, sellable: true, buyable: true, onAave: true },
  { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8, sellable: true, buyable: true, onAave: true },
  { symbol: "PAXG", address: "0x553d3D295e0f695B9228246232eDF400ed3560B5", decimals: 18, sellable: true, buyable: true, onAave: false },
];

export const docToken = (address: string): DocToken | undefined =>
  DOC_TOKENS.find((t) => t.address.toLowerCase() === (address || "").toLowerCase());

export const shortAddr = (a?: string) =>
  a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";

const A = DOC.ADDR;

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
 * on chain; this list only bounds where the money is allowed to go — it is
 * the security boundary the whitelist proposal writes into the modifier, so
 * adding a pool later means another proposal, on purpose.
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
    ? unoswapInterface.encodeFunctionData("unoswapTo", [...head, words[0]])
    : unoswapInterface.encodeFunctionData("unoswapTo2", [...head, words[0], words[1]]);
};

/* -------------------------------------------------------------------------- */
/* The whitelist                                                              */
/* -------------------------------------------------------------------------- */

/**
 * What the whitelist proposal (docProposal.ts) pins on the two entry points,
 * derived from the same pool list the routes above are built from — so the
 * console and the modifier cannot disagree about where the money may go.
 *
 * The words are split by slot rather than pooled: a direct `unoswapTo` may
 * only use a pool between two vault assets, and a two-hop `unoswapTo2` must
 * leave a vault asset through `dex` and come back into one through `dex2`.
 * That is what keeps the hop tokens (USDC, USDC.e) from ever being the thing
 * the vault ends up holding — role 1 cannot sell them, so a trade that ended
 * there would need a governance vote to undo.
 */
export interface DocUnoswapRules {
  /** `to`: the Safe, as a 32-byte word. */
  safeWord: string;
  /** `token`: the assets role 1 may sell, as 32-byte words. */
  tokenWords: string[];
  /** unoswapTo `dex`: a listed pool between two vault assets, either way. */
  directWords: bigint[];
  /** unoswapTo2 `dex`: a listed pool from a vault asset into a hop token. */
  firstHopWords: bigint[];
  /** unoswapTo2 `dex2`: a listed pool from a hop token into a vault asset. */
  secondHopWords: bigint[];
}

const isVaultAsset = (symbol: string) => DOC_TOKENS.some((t) => t.symbol === symbol);
const isHopToken = (symbol: string) => symbol in HOP_TOKENS;

/** Every (pool, direction) in the list that satisfies `keep`, as dex words. */
const wordsWhere = (keep: (sell: string, buy: string) => boolean): bigint[] =>
  DOC_POOLS.flatMap((pool) =>
    [
      [pool.a, pool.b],
      [pool.b, pool.a],
    ]
      .filter(([sell, buy]) => keep(sell, buy))
      .map(([sell, buy]) => dexWord(pool.address, addressOf(sell), addressOf(buy))),
  );

export const DOC_UNOSWAP_RULES: DocUnoswapRules = {
  safeWord: wordHex(A.safe),
  tokenWords: DOC_TOKENS.map((t) => wordHex(t.address)),
  directWords: wordsWhere((sell, buy) => isVaultAsset(sell) && isVaultAsset(buy)),
  firstHopWords: wordsWhere((sell, buy) => isVaultAsset(sell) && isHopToken(buy)),
  secondHopWords: wordsWhere((sell, buy) => isHopToken(sell) && isVaultAsset(buy)),
};

/** The pool and direction a dex word names, if it is one of ours. */
export const describeDexWord = (word: bigint): DocRouteHop | null => {
  const address = word & ((1n << 160n) - 1n);
  const pool = DOC_POOLS.find((p) => BigInt(p.address) === address);
  if (!pool) return null;
  for (const [sell, buy] of [
    [pool.a, pool.b],
    [pool.b, pool.a],
  ]) {
    if (dexWord(pool.address, addressOf(sell), addressOf(buy)) === word) return { pool, sell, buy };
  }
  return null;
};

/**
 * Everything the modifier would refuse about a built swap, said before the
 * wallet opens, plus whether it is the trade the plan asked for. The console
 * only ever builds calls that pass this; it runs anyway, so a change to the
 * routing can never quietly produce a call the whitelist does not cover.
 */
export const validateDocUnoswap = (
  data: string,
  intent: { sell: DocToken; buy: DocToken; amount: bigint },
): string[] => {
  let call: UnoswapCalldata;
  try {
    call = parseUnoswap(data);
  } catch (error: any) {
    return [error?.message ?? "That is not an unoswapTo call."];
  }
  const problems: string[] = [];
  const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

  if (!same(call.to, A.safe)) {
    problems.push(`Proceeds must land in the Safe, not ${shortAddr(call.to)}.`);
  }
  if (!DOC_TOKENS.some((t) => same(t.address, call.token))) {
    problems.push(`The whitelist does not allow selling ${shortAddr(call.token)}.`);
  }
  const slots =
    call.dex.length === 1
      ? [{ name: "dex", allowed: DOC_UNOSWAP_RULES.directWords }]
      : [
        { name: "dex", allowed: DOC_UNOSWAP_RULES.firstHopWords },
        { name: "dex2", allowed: DOC_UNOSWAP_RULES.secondHopWords },
      ];
  const hops = call.dex.map(describeDexWord);
  call.dex.forEach((word, i) => {
    if (slots[i].allowed.includes(word)) return;
    const hop = hops[i];
    problems.push(
      hop
        ? `${hop.sell} → ${hop.buy} through ${shortAddr(hop.pool.address)} is not allowed as ${slots[i].name}.`
        : `Pool word …${word.toString(16).slice(-8)} is not on the whitelist.`,
    );
  });

  if (!same(call.token, intent.sell.address)) {
    problems.push(`This sells ${shortAddr(call.token)}, not ${intent.sell.symbol}.`);
  }
  const first = hops[0];
  const last = hops[hops.length - 1];
  if (first && first.sell !== intent.sell.symbol) {
    problems.push(`The first pool is entered with ${first.sell}, not ${intent.sell.symbol}.`);
  }
  if (last && last.buy !== intent.buy.symbol) {
    problems.push(`This route ends in ${last.buy}, not ${intent.buy.symbol}.`);
  }
  if (hops.length === 2 && hops[0] && hops[1] && hops[0].buy !== hops[1].sell) {
    problems.push("The two hops do not connect.");
  }
  if (call.amount !== intent.amount) {
    problems.push("The amount in the calldata is not the amount planned.");
  }
  if (call.minReturn === 0n) {
    problems.push("minReturn is zero, so this would accept any fill at all.");
  }
  return problems;
};

/** Money for reading, never for maths — the bigint stays the source of truth. */
export const fmtUnits = (v: bigint, decimals: number, dp = 4) =>
  Number(ethers.formatUnits(v ?? 0n, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  });
