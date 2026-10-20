/**
 * Venture staking projection: the REFI a deposit earns over the first year
 * and what it is worth at a given FDV. Pure math, no framework imports, so
 * the staking flow can reuse it and the tests can pin it.
 *
 * Everything is measured in USD at deposit time: ETH, WBTC and USDC fill the
 * same tiers and weigh in the same pool by what they were worth when they
 * came in.
 */
import {
  VENTURE_STAKING,
  VENTURE_STAKING_ASSETS,
  type VentureAsset,
  type VentureTier,
} from "./ventureStakingConfig";

export type VentureStakingProgram = typeof VENTURE_STAKING;

/** The ETH-only form the program spec states its examples in. */
export interface VentureProjectionInput {
  eth: number;
  /** ETH staked in the vault right now; 0 (or unknown) means pre-launch. */
  livePoolEth: number;
  fdvMillions: number;
}

export interface VentureStakeInput {
  asset: VentureAsset;
  amount: number;
  /** USD deposited so far (at deposit-time prices); 0 or unknown means pre-launch. */
  livePoolUsd: number;
  fdvMillions: number;
}

export interface VentureProjection {
  /** The deposit at USD value; what the tiers and the pool weigh. */
  amountUsd: number;
  tier: VentureTier;
  /** USD already deposited ahead of the visitor. */
  existingUsd: number;
  /** True when the pool size is the launch assumption, not a live read. */
  isAssumedPool: boolean;
  monthOneShare: number;
  refi12: number;
  pricePerRefi: number;
  valueUsd: number;
  /** Yearly yield given up, in the deposited asset. */
  yieldRedirected: number;
  yieldRedirectedUsd: number;
  multipleVsYield: number;
}

/** First-month emission: the allocation spread over a decaying geometric series. */
export const monthOneEmission = (program: VentureStakingProgram = VENTURE_STAKING) => {
  const allocation = program.supply * program.stakerAllocationShare;
  let weights = 0;
  for (let t = 0; t < program.emissionMonths; t++) {
    weights += (1 - program.monthlyDecay) ** t;
  }
  return allocation / weights;
};

export const monthlyEmission = (
  month: number,
  program: VentureStakingProgram = VENTURE_STAKING,
) => monthOneEmission(program) * (1 - program.monthlyDecay) ** month;

/** The tier the dollar at `positionUsd` (0-based, in deposit order) falls into. */
export const tierAt = (
  positionUsd: number,
  program: VentureStakingProgram = VENTURE_STAKING,
): VentureTier => {
  let start = 0;
  for (const tier of program.tiers) {
    if (positionUsd < start + tier.capacityUsd) return tier;
    start += tier.capacityUsd;
  }
  return program.tiers[program.tiers.length - 1];
};

/** A tier's bonus fades in 12-month steps: 1, 0.5, 0.25, then gone. */
export const effectiveMultiplier = (
  tier: VentureTier,
  month: number,
  program: VentureStakingProgram = VENTURE_STAKING,
) => {
  const step = Math.floor(month / 12);
  const fade = program.multiplierFade[Math.min(step, program.multiplierFade.length - 1)];
  return 1 + (tier.baseMultiplier - 1) * fade;
};

/** Multiplier-weighted size of `usd` deposited from position 0, walking the tiers in order. */
export const weightedPool = (
  usd: number,
  month: number,
  program: VentureStakingProgram = VENTURE_STAKING,
) => {
  let remaining = usd;
  let weighted = 0;
  for (const tier of program.tiers) {
    if (remaining <= 0) break;
    const inTier = Math.min(remaining, tier.capacityUsd);
    weighted += inTier * effectiveMultiplier(tier, month, program);
    remaining -= inTier;
  }
  return weighted;
};

/**
 * The visitor's whole deposit takes the tier at the end of the existing pool,
 * and the pool is held at its current size for the horizon (no inflows).
 * Returns null for a missing or non-positive amount so the UI shows dashes.
 */
export const projectVentureStake = (
  { asset, amount, livePoolUsd, fdvMillions }: VentureStakeInput,
  program: VentureStakingProgram = VENTURE_STAKING,
): VentureProjection | null => {
  if (
    !Number.isFinite(amount) || amount <= 0 ||
    !Number.isFinite(fdvMillions) || fdvMillions <= 0
  ) {
    return null;
  }
  const amountUsd = amount * asset.priceUsd;
  const isAssumedPool = !(Number.isFinite(livePoolUsd) && livePoolUsd > 0);
  const existingUsd = isAssumedPool
    ? Math.max(program.assumedLaunchPoolUsd - amountUsd, 0)
    : livePoolUsd;
  const tier = tierAt(existingUsd, program);
  const e0 = monthOneEmission(program);

  let refi12 = 0;
  let monthOneShare = 0;
  for (let k = 0; k < program.horizonMonths; k++) {
    const mine = amountUsd * effectiveMultiplier(tier, k, program);
    const share = mine / (weightedPool(existingUsd, k, program) + mine);
    if (k === 0) monthOneShare = share;
    refi12 += share * e0 * (1 - program.monthlyDecay) ** k;
  }

  const pricePerRefi = (fdvMillions * 1e6) / program.supply;
  const valueUsd = refi12 * pricePerRefi;
  const yieldRedirected = amount * asset.yieldRate;
  const yieldRedirectedUsd = yieldRedirected * asset.priceUsd;

  return {
    amountUsd,
    tier,
    existingUsd,
    isAssumedPool,
    monthOneShare,
    refi12,
    pricePerRefi,
    valueUsd,
    yieldRedirected,
    yieldRedirectedUsd,
    multipleVsYield: valueUsd / yieldRedirectedUsd,
  };
};

/** The ETH case, as the program spec states it. */
export const projectVentureStaking = (
  { eth, livePoolEth, fdvMillions }: VentureProjectionInput,
  program: VentureStakingProgram = VENTURE_STAKING,
) => projectVentureStake(
  {
    asset: { ...VENTURE_STAKING_ASSETS[0], priceUsd: program.ethPriceUsd, yieldRate: program.stakingYield },
    amount: eth,
    livePoolUsd: livePoolEth * program.ethPriceUsd,
    fdvMillions,
  },
  program,
);

/** REFI emitted in each month of the program, month 0 first. */
export const emissionSchedule = (program: VentureStakingProgram = VENTURE_STAKING) => {
  const e0 = monthOneEmission(program);
  return Array.from(
    { length: program.emissionMonths },
    (_, month) => e0 * (1 - program.monthlyDecay) ** month,
  );
};

export interface TierFill {
  tier: VentureTier;
  /** Pool position where the tier starts, in USD. */
  startUsd: number;
  filledUsd: number;
  /** 0..1; the open tier reads 0 until something lands in it, then 1. */
  ratio: number;
  isCurrent: boolean;
}

/** How full each tier is after `poolUsd` of deposits, and which one a new deposit enters. */
export const tierFills = (
  poolUsd: number,
  program: VentureStakingProgram = VENTURE_STAKING,
): TierFill[] => {
  const pool = Number.isFinite(poolUsd) && poolUsd > 0 ? poolUsd : 0;
  const current = tierAt(pool, program);
  let start = 0;
  return program.tiers.map((tier) => {
    const filledUsd = Math.min(Math.max(pool - start, 0), tier.capacityUsd);
    const fill = {
      tier,
      startUsd: start,
      filledUsd,
      ratio: Number.isFinite(tier.capacityUsd) ? filledUsd / tier.capacityUsd : filledUsd > 0 ? 1 : 0,
      isCurrent: tier === current,
    };
    start += tier.capacityUsd;
    return fill;
  });
};
