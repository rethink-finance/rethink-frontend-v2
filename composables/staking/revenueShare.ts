/**
 * Revenue share math: what REFI holders receive when 100% of the protocol's
 * fees on AUM are distributed to staked REFI. Pure, so it can be tested.
 */
import { VENTURE_STAKING } from "./ventureStakingConfig";

export interface RevenueShareInput {
  aumUsd: number;
  feeBps: number;
  /** Share of REFI supply that is staked and receives the fees, 0..1. */
  stakedShare: number;
  fdvMillions: number;
}

export interface RevenueShare {
  /** Fees distributed to REFI holders a year. */
  feesUsd: number;
  /** Yearly yield on staked REFI at the scenario price. */
  stakedApr: number;
  /** Fees spent buying REFI each day, if distributions buy on the market. */
  dailyBuyUsd: number;
  /** Share of total supply those buys absorb in a year. */
  supplyBoughtShare: number;
  /** FDV over yearly fees: how many years of fees the valuation is. */
  priceToFees: number;
  /** AUM at which staked REFI yields as much as staked ETH. */
  breakEvenAumUsd: number;
}

export const annualFees = (aumUsd: number, feeBps: number) => aumUsd * (feeBps / 10_000);

/** Yield on staked REFI for a given AUM; the curve the chart draws. */
export const stakedAprAt = (
  aumUsd: number,
  { feeBps, stakedShare, fdvMillions }: Omit<RevenueShareInput, "aumUsd">,
) => annualFees(aumUsd, feeBps) / (fdvMillions * 1e6 * stakedShare);

export const revenueShare = (
  input: RevenueShareInput,
  program = VENTURE_STAKING,
): RevenueShare | null => {
  const { aumUsd, feeBps, stakedShare, fdvMillions } = input;
  if (![aumUsd, feeBps, stakedShare, fdvMillions].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  const fdvUsd = fdvMillions * 1e6;
  const feesUsd = annualFees(aumUsd, feeBps);
  const price = fdvUsd / program.supply;
  return {
    feesUsd,
    stakedApr: stakedAprAt(aumUsd, input),
    dailyBuyUsd: feesUsd / 365,
    supplyBoughtShare: feesUsd / price / program.supply,
    priceToFees: fdvUsd / feesUsd,
    breakEvenAumUsd: (program.stakingYield * fdvUsd * stakedShare) / (feeBps / 10_000),
  };
};
