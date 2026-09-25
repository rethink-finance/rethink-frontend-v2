import { ethers } from "ethers";
import { INDEFI, INDEFI_POOLS, INDEFI_TOKENS } from "./indefiConsole";
import {
  UNOSWAP_TO2_SELECTOR,
  UNOSWAP_TO_SELECTOR,
  allowedDexWords,
  wordHex,
} from "./onchainSwap";
import { ONE_INCH_SWAP_SELECTOR } from "./oneInchSwap";

/**
 * The governance proposal that lets INDEFI's manager swap again without an
 * aggregator API or a contract of ours: the vault's governor (owner of the
 * Roles v1 modifier) scopes the 1inch router's `unoswapTo` and `unoswapTo2`
 * for role 1 and revokes `swap()`.
 *
 * What a compromised manager key can and cannot do afterwards:
 *   · proceeds can only land in the Safe (`to` pinned);
 *   · only the vault's own assets can be sold (`token` one-of);
 *   · only the listed canonical Uniswap V3 pools can be traded through, in
 *     either direction, with no unwrap or permit flags (`dex`, `dex2` one-of
 *     exact words) — so no attacker-made pool, and the bought token is
 *     always the other side of a listed pair;
 *   · `swap()` and its free executor slot are gone.
 *   · what remains is the price it accepts: `minReturn` cannot be tied to
 *     the amount by any Roles v1 condition, so a key holder could still
 *     take a bad fill in a listed pool. The pools are the deepest on Base,
 *     which makes that expensive rather than impossible.
 *
 * Rehearsed on a Base fork in contracts/indefi-unoswap-whitelist: the
 * governor applies these calls, the manager trades through every listed
 * pool, and each forbidden shape is refused.
 */

/** Zodiac Roles v1 owner functions (Permissions library), as the modifier exposes them. */
export const rolesV1ScopeInterface = new ethers.Interface([
  "function scopeParameter(uint16 role,address targetAddress,bytes4 functionSig,uint256 paramIndex,uint8 paramType,uint8 paramComp,bytes compValue)",
  "function scopeParameterAsOneOf(uint16 role,address targetAddress,bytes4 functionSig,uint256 paramIndex,uint8 paramType,bytes[] compValues)",
  "function scopeRevokeFunction(uint16 role,address targetAddress,bytes4 functionSig)",
]);

/** Roles v1 enums. */
export const V1_PARAM_STATIC = 0;
export const V1_COMPARISON_EQUAL_TO = 0;

export interface ProposalCall {
  target: string;
  value: bigint;
  data: string;
  /** One line for the proposal description and the review. */
  summary: string;
}

const ROLE = Number(INDEFI.ROLE);

/** unoswapTo(to, token, amount, minReturn, dex) / unoswapTo2(…, dex, dex2). */
const PARAM_TO = 0;
const PARAM_TOKEN = 1;
const PARAM_DEX = 4;
const PARAM_DEX2 = 5;

export const buildIndefiUnoswapProposal = (): ProposalCall[] => {
  const modifier = INDEFI.ADDR.roles;
  const router = INDEFI.ADDR.oneInch;
  const safeWord = wordHex(INDEFI.ADDR.safe);
  const tokenWords = INDEFI_TOKENS.map((t) => wordHex(t.address));
  const dexWords = allowedDexWords(INDEFI_POOLS).map(wordHex);
  const call = (fn: string, args: unknown[], summary: string): ProposalCall => ({
    target: modifier,
    value: 0n,
    data: rolesV1ScopeInterface.encodeFunctionData(fn, args),
    summary,
  });
  const scopeEntryPoint = (selector: string, name: string, withDex2: boolean): ProposalCall[] => [
    call(
      "scopeParameter",
      [ROLE, router, selector, PARAM_TO, V1_PARAM_STATIC, V1_COMPARISON_EQUAL_TO, safeWord],
      `${name}: pin \`to\` to the Safe ${INDEFI.ADDR.safe}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, selector, PARAM_TOKEN, V1_PARAM_STATIC, tokenWords],
      `${name}: \`token\` one-of ${INDEFI_TOKENS.map((t) => t.symbol).join(", ")}`,
    ),
    call(
      "scopeParameterAsOneOf",
      [ROLE, router, selector, PARAM_DEX, V1_PARAM_STATIC, dexWords],
      `${name}: \`dex\` one-of the ${INDEFI_POOLS.length} listed pools, both directions`,
    ),
    ...(withDex2
      ? [
        call(
          "scopeParameterAsOneOf",
          [ROLE, router, selector, PARAM_DEX2, V1_PARAM_STATIC, dexWords],
          `${name}: \`dex2\` one-of the same pools`,
        ),
      ]
      : []),
  ];
  return [
    ...scopeEntryPoint(UNOSWAP_TO_SELECTOR, "unoswapTo", false),
    ...scopeEntryPoint(UNOSWAP_TO2_SELECTOR, "unoswapTo2", true),
    call(
      "scopeRevokeFunction",
      [ROLE, router, ONE_INCH_SWAP_SELECTOR],
      "Revoke `swap()` — the entry point whose free executor slot let any calldata take the sold tokens",
    ),
  ];
};

/** The proposal text, listing every call so voters can check the words. */
export const describeIndefiUnoswapProposal = (): string => {
  const calls = buildIndefiUnoswapProposal();
  const pools = INDEFI_POOLS.map((p) => `- ${p.label} — ${p.address}`).join("\n");
  return [
    "# Let the manager swap through fixed Uniswap V3 pools; retire 1inch swap()",
    "",
    "Role 1 on the Roles modifier gains `unoswapTo` and `unoswapTo2` on the 1inch router",
    "with the receiver pinned to the Safe, the sold token limited to USDC/WETH/AERO and the",
    "pool limited to the list below (both directions, no flags). `swap()` is revoked: its",
    "executor argument was unconstrained, and the 1inch web app can no longer produce the",
    "calldata it needs anyway.",
    "",
    "Pools:",
    pools,
    "",
    "Calls (all to the Roles modifier " + INDEFI.ADDR.roles + "):",
    ...calls.map((c, i) => `${i + 1}. ${c.summary}`),
  ].join("\n");
};
