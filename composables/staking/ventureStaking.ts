/**
 * Venture staking projection: the REFI a deposit earns over the first year
 * and what it is worth at a given FDV. Pure math, no framework imports, so
 * the staking flow can reuse it and the tests can pin it.
 */
import {
  VENTURE_STAKING,
  VENTURE_STAKING_ASSETS,
  type VentureAsset,
  type VentureTier,
} from "./ventureStakingConfig";

export type VentureStakingProgram = typeof VENTURE_STAKING;

export interface VentureProjectionInput {
  eth: number;
  /** ETH staked in the vault right now; 0 (or unknown) means pre-launch. */
  livePoolEth: number;
  fdvMillions: number;
}

export interface VentureStakeInput {
  asset: VentureAsset;
  amount: number;
  livePoolEth: number;
  fdvMillions: number;
}

export interface VentureProjection {
  /** The deposit in ETH at USD value; what the tiers and the pool weigh. */
  ethEquivalent: number;
  tier: VentureTier;
  /** ETH already in the pool ahead of the visitor. */
  existingEth: number;
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

/** The tier the ETH at `position` (0-based, in deposit order) falls into. */
export const tierAt = (
  position: number,
  program: VentureStakingProgram = VENTURE_STAKING,
): VentureTier => {
  let start = 0;
  for (const tier of program.tiers) {
    if (position < start + tier.capacityEth) return tier;
    start += tier.capacityEth;
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

/** Multiplier-weighted size of `eth` deposited from position 0, walking the tiers in order. */
export const weightedPool = (
  eth: number,
  month: number,
  program: VentureStakingProgram = VENTURE_STAKING,
) => {
  let remaining = eth;
  let weighted = 0;
  for (const tier of program.tiers) {
    if (remaining <= 0) break;
    const inTier = Math.min(remaining, tier.capacityEth);
    weighted += inTier * effectiveMultiplier(tier, month, program);
    remaining -= inTier;
  }
  return weighted;
};

/**
 * The visitor's whole deposit takes the tier at the end of the existing pool,
 * and the pool is held at its current size for the horizon (no inflows).
 * A WBTC or USDC deposit weighs in at its ETH value; the yield it gives up is
 * its own. Returns null for a missing or non-positive amount so the UI shows
 * dashes.
 */
export const projectVentureStake = (
  { asset, amount, livePoolEth, fdvMillions }: VentureStakeInput,
  program: VentureStakingProgram = VENTURE_STAKING,
): VentureProjection | null => {
  if (
    !Number.isFinite(amount) || amount <= 0 ||
    !Number.isFinite(fdvMillions) || fdvMillions <= 0
  ) {
    return null;
  }
  const eth = (amount * asset.priceUsd) / program.ethPriceUsd;
  const isAssumedPool = !(Number.isFinite(livePoolEth) && livePoolEth > 0);
  const existingEth = isAssumedPool
    ? Math.max(program.assumedLaunchPoolEth - eth, 0)
    : livePoolEth;
  const tier = tierAt(existingEth, program);
  const e0 = monthOneEmission(program);

  let refi12 = 0;
  let monthOneShare = 0;
  for (let k = 0; k < program.horizonMonths; k++) {
    const mine = eth * effectiveMultiplier(tier, k, program);
    const share = mine / (weightedPool(existingEth, k, program) + mine);
    if (k === 0) monthOneShare = share;
    refi12 += share * e0 * (1 - program.monthlyDecay) ** k;
  }

  const pricePerRefi = (fdvMillions * 1e6) / program.supply;
  const valueUsd = refi12 * pricePerRefi;
  const yieldRedirected = amount * asset.yieldRate;
  const yieldRedirectedUsd = yieldRedirected * asset.priceUsd;

  return {
    ethEquivalent: eth,
    tier,
    existingEth,
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
    livePoolEth,
    fdvMillions,
  },
  program,
);
