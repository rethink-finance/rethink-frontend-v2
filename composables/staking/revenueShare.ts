/**
 * Buyback math: 100% of the fees Rethink Finance earns on AUM buy REFI on
 * the market. Pure, so it can be tested.
 */
import { emissionSchedule } from "./ventureStaking";
import { VENTURE_STAKING } from "./ventureStakingConfig";

export interface BuybackInput {
  aumUsd: number;
  feeBps: number;
  fdvMillions: number;
}

export interface Buybacks {
  /** Revenue spent buying REFI a year. */
  yearlyUsd: number;
  dailyUsd: number;
  /** REFI bought a year at the scenario price. */
  tokensPerYear: number;
  /** Share of total supply bought back a year. */
  supplyShare: number;
}

export const annualFees = (aumUsd: number, feeBps: number) => aumUsd * (feeBps / 10_000);

/** Share of supply bought back a year at a given AUM; the curve the chart draws. */
export const buybackShareAt = (
  aumUsd: number,
  { feeBps, fdvMillions }: Omit<BuybackInput, "aumUsd">,
) => annualFees(aumUsd, feeBps) / (fdvMillions * 1e6);

/** Share of supply the staking program emits in program year `year` (1-based). */
export const emissionShareInYear = (year: number, program = VENTURE_STAKING) =>
  emissionSchedule(program)
    .slice((year - 1) * 12, year * 12)
    .reduce((sum, value) => sum + value, 0) / program.supply;

/** AUM at which a year's buybacks absorb `supplyShare` of the supply. */
export const aumToBuyBack = (
  supplyShare: number,
  { feeBps, fdvMillions }: Omit<BuybackInput, "aumUsd">,
) => (supplyShare * fdvMillions * 1e6) / (feeBps / 10_000);

export const buybacks = (input: BuybackInput, program = VENTURE_STAKING): Buybacks | null => {
  const { aumUsd, feeBps, fdvMillions } = input;
  if (![aumUsd, feeBps, fdvMillions].every((n) => Number.isFinite(n) && n > 0)) return null;
  const yearlyUsd = annualFees(aumUsd, feeBps);
  const price = (fdvMillions * 1e6) / program.supply;
  return {
    yearlyUsd,
    dailyUsd: yearlyUsd / 365,
    tokensPerYear: yearlyUsd / price,
    supplyShare: buybackShareAt(aumUsd, input),
  };
};
