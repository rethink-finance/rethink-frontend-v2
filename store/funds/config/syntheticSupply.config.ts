import type { ChainId } from "~/types/enums/chain_id";

/**
 * Vaults funded by a direct transfer into custody rather than through the deposit
 * module never minted shares, so their `totalSupply()` is 0 and every share price
 * derived from it divides by zero and lands on 0.
 *
 * The backend is the source of truth here and applies the same stand-in supply when
 * it writes snapshots — see `src/nav/utils/synthetic-supply.ts` in rethink-backend,
 * which carries the full rationale. This mirror exists only for the exchange rates
 * the app computes client-side from on-chain supply rather than reading back from a
 * snapshot; keep the two in step.
 *
 * The stand-in is a divisor, never a supply. Do not display it as one — on chain the
 * supply really is zero.
 */
const SYNTHETIC_TOTAL_SUPPLY: Record<string, bigint> = {
  /**
   * ShineDAO Treasury on Polygon, priced against its NAV at the first non-zero NAV
   * update on 2024-08-14, which puts its share price at exactly 1.00 DAI that day.
   */
  "0x89:0x0dcd5d9cf6dff56e7ce2cbed1d39369e1b5f2ac4": 1065985808636508192791276n,
};

/**
 * The share count to price a vault's NAV against: its real supply whenever it has
 * minted any, and the stand-in only when it has none at all. A vault that later
 * mints real shares stops using the stand-in on its own.
 */
export const resolveEffectiveTotalSupply = (
  chainId: ChainId | string | undefined,
  fundTokenAddress: string | undefined,
  totalSupply: bigint | undefined,
): bigint | undefined => {
  if (totalSupply && totalSupply > 0n) return totalSupply;

  const key = `${chainId ?? ""}:${(fundTokenAddress ?? "").toLowerCase()}`;
  return SYNTHETIC_TOTAL_SUPPLY[key] ?? totalSupply;
};
