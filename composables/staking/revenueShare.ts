/**
 * Buyback math: 100% of the revenue Rethink Finance earns buys REFI on the
 * market. Revenue comes from a platform fee on AUM, a share of what managers
 * earn, and referral fees. Pure, so it can be tested.
 */
import { emissionSchedule } from "./ventureStaking";
import {
  VENTURE_BUYBACKS,
  VENTURE_STAKING,
  type VentureRevenueModel,
} from "./ventureStakingConfig";

export interface RevenueBreakdown {
  platformUsd: number;
  managersUsd: number;
  referralsUsd: number;
  totalUsd: number;
  /** Total revenue as basis points of AUM. */
  totalBps: number;
}

export const revenueBreakdown = (
  aumUsd: number,
  model: VentureRevenueModel = VENTURE_BUYBACKS.revenue,
): RevenueBreakdown => {
  const platformUsd = aumUsd * (model.platformFeeBps / 10_000);
  const managersUsd = aumUsd * (model.managerEarningsBps / 10_000) * model.managerShare;
  const referralsUsd = aumUsd * (model.referralBps / 10_000);
  const totalUsd = platformUsd + managersUsd + referralsUsd;
  return { platformUsd, managersUsd, referralsUsd, totalUsd, totalBps: (totalUsd / aumUsd) * 10_000 };
};

/** Share of supply the staking program emits in program year `year` (1-based). */
export const emissionShareInYear = (year: number, program = VENTURE_STAKING) =>
  emissionSchedule(program)
    .slice((year - 1) * 12, year * 12)
    .reduce((sum, value) => sum + value, 0) / program.supply;

export interface BuybackYear {
  year: number;
  aumUsd: number;
  revenueUsd: number;
  /** Share of supply bought back that year at the scenario price. */
  buybackShare: number;
  /** Share of supply the program emits that year. */
  emissionShare: number;
  /** FDV over that year's revenue. */
  priceToRevenue: number;
}

export interface BuybackProjection {
  years: BuybackYear[];
  /** First year buybacks take more REFI off the market than the program adds. */
  netDeflationaryYear: number | null;
  /** Share of supply bought back over the whole horizon. */
  totalBuybackShare: number;
}

/**
 * Buybacks year by year with AUM compounding at `growth`, all bought at the
 * scenario price (a rising price would buy fewer tokens for the same dollars).
 */
export const buybackProjection = (
  { startAumUsd, growth, fdvMillions }: { startAumUsd: number; growth: number; fdvMillions: number },
  model: VentureRevenueModel = VENTURE_BUYBACKS.revenue,
  years: number = VENTURE_BUYBACKS.years,
  program = VENTURE_STAKING,
): BuybackProjection | null => {
  if (![startAumUsd, fdvMillions].every((n) => Number.isFinite(n) && n > 0) || !(growth >= 0)) {
    return null;
  }
  const fdvUsd = fdvMillions * 1e6;
  const rows = Array.from({ length: years }, (_, i) => {
    const aumUsd = startAumUsd * (1 + growth) ** i;
    const revenueUsd = revenueBreakdown(aumUsd, model).totalUsd;
    return {
      year: i + 1,
      aumUsd,
      revenueUsd,
      buybackShare: revenueUsd / fdvUsd,
      emissionShare: emissionShareInYear(i + 1, program),
      priceToRevenue: fdvUsd / revenueUsd,
    };
  });
  return {
    years: rows,
    netDeflationaryYear: rows.find((row) => row.buybackShare >= row.emissionShare)?.year ?? null,
    totalBuybackShare: rows.reduce((sum, row) => sum + row.buybackShare, 0),
  };
};
