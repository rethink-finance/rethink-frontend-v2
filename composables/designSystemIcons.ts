import chainArb from "~/assets/icons/chain-arb.png";
import chainBase from "~/assets/icons/chain-base.png";
import chainEth from "~/assets/icons/chain-eth.png";
import chainHype from "~/assets/icons/chain-hype.png";
import chainPol from "~/assets/icons/chain-pol.png";
import tokenUsdc from "~/assets/icons/token-usdc.png";
import tokenUsdt from "~/assets/icons/token-usdt.png";
import tokenWbtc from "~/assets/icons/token-wbtc.png";
import tokenWeth from "~/assets/icons/token-weth.png";
import { ChainId } from "~/types/enums/chain_id";

/**
 * The network and token marks from the design system, in `assets/icons`.
 *
 * These are the source for every chain and token icon in the app. Icon sets
 * pulled from Iconify remain as a fallback only for marks the design system
 * does not ship — today that is DAI and the local test node — because the
 * alternative is no icon at all. Anything the design system does cover comes
 * from here, so a mark only ever changes by replacing the file.
 *
 * Bar one, every mark is a disc drawn to the edge of a transparent square, so
 * it needs nothing painted behind it — anything there would only show through
 * the corners as a rim. Base's mark is the exception, a full-bleed square, and
 * rounding the frame is enough to give it the same silhouette as the rest.
 */

/**
 * One diameter for chain and token marks alike, so the two never disagree
 * where they sit side by side. Both IconChain and IconBaseAsset default to it,
 * and callers that need another size override both together.
 */
export const ICON_SIZE_PX = 18;

/** Keyed by the chain's short code, the same key `getChainIcon` uses. */
const CHAIN_ICONS: Record<string, string> = {
  arb1: chainArb,
  base: chainBase,
  eth: chainEth,
  HyperEVM: chainHype,
  matic: chainPol,
};

/** Short code for each chain id, so callers can pass either. */
const CHAIN_SHORT_BY_ID: Partial<Record<ChainId, string>> = {
  [ChainId.ARBITRUM]: "arb1",
  [ChainId.BASE]: "base",
  [ChainId.ETHEREUM]: "eth",
  [ChainId.HYPEREVM]: "HyperEVM",
  [ChainId.POLYGON]: "matic",
};

/** Keyed by token symbol, uppercased. */
const TOKEN_ICONS: Record<string, string> = {
  USDC: tokenUsdc,
  USDT: tokenUsdt,
  WBTC: tokenWbtc,
  WETH: tokenWeth,
};

/**
 * The design system's mark for a chain, by short code or chain id, or
 * undefined when the set does not include one.
 */
export const getDesignChainIcon = (
  chainShort?: string,
  chainId?: string,
): string | undefined => {
  if (chainShort && CHAIN_ICONS[chainShort]) return CHAIN_ICONS[chainShort];

  const shortFromId = CHAIN_SHORT_BY_ID[chainId as ChainId];
  return shortFromId ? CHAIN_ICONS[shortFromId] : undefined;
};

/** The design system's mark for a token symbol, or undefined when unlisted. */
export const getDesignTokenIcon = (symbol?: string): string | undefined =>
  symbol ? TOKEN_ICONS[symbol.toUpperCase()] : undefined;
