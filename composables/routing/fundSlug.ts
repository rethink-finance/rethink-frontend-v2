import type { ChainId } from "~/types/enums/chain_id";

/**
 * A vault's details URL is `/details/<chainId>-<fundTokenSymbol>-<fundAddress>`.
 *
 * A token symbol can itself contain hyphens (OAUBTC-T, SMART10-HL,
 * OA-V2-CANARY-B), so the slug cannot be split into three parts: the chain is
 * the first segment, the address is the last, and the symbol is whatever lies
 * between. Only the chain and the address load a vault; the symbol is cosmetic.
 */
export interface ParsedFundSlug {
  chainId: ChainId;
  symbol: string;
  address: string;
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export const buildFundSlug = (
  chainId: ChainId | string,
  fundTokenSymbol: string,
  fundAddress: string,
): string => `${chainId}-${fundTokenSymbol}-${fundAddress}`;

/**
 * Inverse of buildFundSlug. A slug whose last segment is not an address
 * (too few segments, or a symbol fragment where the address should be)
 * reports an empty address rather than handing a symbol to the chain.
 */
export const parseFundSlug = (slug: string | undefined): ParsedFundSlug => {
  const parts = (slug ?? "").split("-");
  const chainId = (parts[0] ?? "") as ChainId;
  if (parts.length < 3) {
    return { chainId, symbol: parts[1] ?? "", address: "" };
  }
  const last = parts[parts.length - 1];
  return {
    chainId,
    symbol: parts.slice(1, -1).join("-"),
    address: ADDRESS_PATTERN.test(last) ? last : "",
  };
};
