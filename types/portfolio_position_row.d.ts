/**
 * One vault as the portfolio's positions table draws it.
 *
 * Everything is pre-formatted by the card that owns the list, so a row renders
 * rather than calculates — bar the pending-request amounts, which need the
 * vault's decimals to hand.
 */
import type { ChainId } from "~/types/enums/chain_id";

export default interface IPortfolioPositionRow {
  key: string;
  chainId: ChainId;
  chainShort: string;
  photoUrl: string;
  symbol: string;
  title: string;
  curator: string;
  baseSymbol: string;
  baseDecimals: number;
  shareDecimals: number;
  tokens: string;
  value: string;
  valueUSD: string;
  /** Em dash where the position has no dollar value to take a share of. */
  allocation: string;
  /** The bar's width, which is empty rather than an em dash in that case. */
  allocationWidth: string;
  return: string;
  /** Empty where the figure rounds to nothing, or there is no figure at all. */
  returnTone: "pos" | "neg" | "";
}
