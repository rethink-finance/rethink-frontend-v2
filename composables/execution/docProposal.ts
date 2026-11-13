import { DOC, DOC_POOLS, DOC_TOKENS, DOC_UNOSWAP_RULES, HOP_TOKENS } from "./docWhitelist";
import {
  V1_COMPARISON_EQUAL_TO,
  V1_PARAM_STATIC,
  rolesV1ScopeInterface,
  type ProposalCall,
} from "./indefiProposal";
import { UNOSWAP_TO2_SELECTOR, UNOSWAP_TO_SELECTOR, wordHex } from "./onchainSwap";
import { ONE_INCH_SWAP_SELECTOR } from "./oneInchSwap";

/**
 * The governance proposal that lets the DoC Treasury Protection manager
 * rebalance from this app again: the vault's governor, which owns the Roles
 * v1 modifier, scopes the 1inch router's `unoswapTo` and `unoswapTo2` for
 * role 1 and revokes `swap()`.
 *
 * Why `swap()` has to go rather than stay beside the new entry points: its
 * routing program is written by 1inch's pathfinder and cannot be built here,
 * the 1inch web app no longer lets a manager force it or set the receiver,
 * and the permission on it pins only the destination — `executor`,
 * `srcReceiver` and `minReturn` are the caller's, so a compromised role-1 key
 * could hand the Safe's approved tokens to its own executor for one wei.
 *
 * What a compromised key can and cannot do afterwards:
 *   · proceeds can only land in the Safe (`to` pinned);
 *   · only DAI, WETH, WBTC and PAXG can be sold (`token` one-of);
 *   · a direct swap may only use a listed pool between two vault assets,
 *     and a two-hop swap may only go vault asset → USDC or USDC.e → vault
 *     asset through listed pools (`dex`, `dex2` one-of exact words). So no
 *     attacker-made pool, no unwrap or permit flags, and the vault never
 *     ends a trade holding a token it cannot sell again;
 *   · `swap()` and its free executor slot are gone.
 *   · what remains is the price it accepts: `minReturn` cannot be tied to
 *     the amount by any Roles v1 condition, so a key holder could still
 *     take a bad fill in a listed pool. The console fills it from a live
 *     quote and the operator's tolerance.
 *
 * Same shape as the INDEFI proposal (indefiProposal.ts), which was rehearsed
 * on a fork; this one was rehearsed against the live Polygon modifier with
 * eth_simulateV1 — see the PR.
 */

const ROLE = Number(DOC.ROLE);

/** unoswapTo(to, token, amount, minReturn, dex) / unoswapTo2(…, dex, dex2). */
const PARAM_TO = 0;
const PARAM_TOKEN = 1;
const PARAM_DEX = 4;
const PARAM_DEX2 = 5;

export const DOC_PROPOSAL_TITLE =
  "Let the manager rebalance through fixed Uniswap V3 pools; retire 1inch swap()";

export const buildDocUnoswapProposal = (): ProposalCall[] => {
  const modifier = DOC.ADDR.roles;
  const router = DOC.ADDR.oneInch;
  const rules = DOC_UNOSWAP_RULES;
  const call = (fn: string, args: unknown[], summary: string): ProposalCall => ({
    target: modifier,
    value: 0n,
    data: rolesV1ScopeInterface.encodeFunctionData(fn, args),
    summary,
  });
  const sellable = DOC_TOKENS.map((t) => t.symbol).join(", ");
  const hops = Object.keys(HOP_TOKENS).join(" or ");
  return [
    call(
      "scopeParameter",
      [ROLE, router, UNOSWAP_TO_SELECTOR, PARAM_TO, V1_PARAM_STATIC, V1_COMPARISON_EQUAL_TO, rules.safeWord],
      `unoswapTo: pin \`to\` to the Safe ${DOC.ADDR.safe}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, UNOSWAP_TO_SELECTOR, PARAM_TOKEN, V1_PARAM_STATIC, rules.tokenWords],
      `unoswapTo: \`token\` one-of ${sellable}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, UNOSWAP_TO_SELECTOR, PARAM_DEX, V1_PARAM_STATIC, rules.directWords.map(wordHex)],
      `unoswapTo: \`dex\` one-of the ${rules.directWords.length} listed pool directions between two vault assets`,
    ),
    call(
      "scopeParameter",
      [ROLE, router, UNOSWAP_TO2_SELECTOR, PARAM_TO, V1_PARAM_STATIC, V1_COMPARISON_EQUAL_TO, rules.safeWord],
      `unoswapTo2: pin \`to\` to the Safe ${DOC.ADDR.safe}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, UNOSWAP_TO2_SELECTOR, PARAM_TOKEN, V1_PARAM_STATIC, rules.tokenWords],
      `unoswapTo2: \`token\` one-of ${sellable}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, UNOSWAP_TO2_SELECTOR, PARAM_DEX, V1_PARAM_STATIC, rules.firstHopWords.map(wordHex)],
      `unoswapTo2: \`dex\` one-of the ${rules.firstHopWords.length} listed pool directions from a vault asset into ${hops}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, UNOSWAP_TO2_SELECTOR, PARAM_DEX2, V1_PARAM_STATIC, rules.secondHopWords.map(wordHex)],
      `unoswapTo2: \`dex2\` one-of the ${rules.secondHopWords.length} listed pool directions from ${hops} back into a vault asset`,
    ),
    call(
      "scopeRevokeFunction",
      [ROLE, router, ONE_INCH_SWAP_SELECTOR],
      "Revoke `swap()` — the entry point whose free executor slot let any calldata take the sold tokens",
    ),
  ];
};

/** The proposal text, listing every pool and every call so voters can check the words. */
export const describeDocUnoswapProposal = (): string => {
  const calls = buildDocUnoswapProposal();
  const pools = DOC_POOLS.map(
    (p) => `- Uniswap V3 ${p.a}/${p.b} ${(p.fee / 10000).toFixed(2)}% — ${p.address}`,
  ).join("\n");
  return [
    `# ${DOC_PROPOSAL_TITLE}`,
    "",
    "Role 1 on the Roles modifier gains `unoswapTo` and `unoswapTo2` on the 1inch router",
    "with the receiver pinned to the Safe, the sold token limited to DAI, WETH, WBTC and PAXG,",
    "and the pools limited to the list below: a direct swap between two vault assets, or two",
    "hops through USDC or USDC.e, so a trade always ends in a vault asset. `swap()` is",
    "revoked: its executor argument was unconstrained, and the 1inch web app can no longer",
    "produce the calldata it needs anyway.",
    "",
    "Pools:",
    pools,
    "",
    "Calls (all to the Roles modifier " + DOC.ADDR.roles + "):",
    ...calls.map((c, i) => `${i + 1}. ${c.summary}`),
  ].join("\n");
};
