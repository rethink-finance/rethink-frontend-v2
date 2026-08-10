import { ChainId } from "~/types/enums/chain_id";

/**
 * Some vaults do not keep the yield they earn. A native ETH staking vault, for
 * instance, holds a constant amount of ETH and hands the validator rewards out
 * as a different token in a different vault — so its NAV, its share price, its
 * cumulative return and its APR are all flat by construction, and the page ends
 * up reporting 0% for a position that is very much earning.
 *
 * This config is the missing half of that story: the yield the underlying
 * position actually pays, and where the depositor goes to collect it. It is
 * hand-maintained per vault rather than read from chain, because the reward
 * stream is off-vault — nothing the contracts expose can tell us about it.
 */
export interface IStakingRewardsConfig {
  /**
   * Average gross annual yield of the underlying staking position, in percent,
   * before the operator's cut.
   *
   * MANUALLY MAINTAINED. There is no oracle for this in the app today, so it is
   * a figure someone has to keep current — revisit it whenever network staking
   * yields move materially, or replace this field with a feed.
   */
  grossYieldPercent: number;

  /** Share of the gross rewards paid to whoever runs the validator, in percent. */
  operatorFeePercent: number;

  /** Token the rewards are paid out in. */
  rewardTokenSymbol: string;

  /** One line explaining where the rewards go, shown under the stats. */
  rewardNote: string;

  /** Label of the button that takes the depositor to their rewards. */
  rewardActionLabel: string;

  /**
   * Route or URL of that vault. Empty while it is not live yet — the button
   * renders as a disabled placeholder rather than a dead link.
   */
  rewardVaultUrl?: string;
}

const stakingRewardsByVault: Record<string, IStakingRewardsConfig> = {
  // soonami Venture Staking — native ETH staking, rewards distributed as SNI.
  [`${ChainId.ETHEREUM}:0xac3d76e29f866702e17f571cccb15937e5a17303`]: {
    grossYieldPercent: 3.2,
    operatorFeePercent: 10,
    rewardTokenSymbol: "SNI",
    rewardNote:
      "Yield is paid out as SNI in a separate vault, so this vault's ETH balance stays flat.",
    rewardActionLabel: "Claim SNI",
  },
};

export interface IResolvedStakingRewards extends IStakingRewardsConfig {
  /** What the depositor is left with once the operator has taken their cut. */
  netYieldPercent: number;
}

/**
 * The staking-rewards story for a vault, or undefined for the vast majority of
 * vaults that keep their yield in-vault and are described correctly by return
 * and APR alone.
 */
export const resolveStakingRewards = (
  chainId?: ChainId | string,
  address?: string,
): IResolvedStakingRewards | undefined => {
  if (!chainId || !address) return undefined;

  const config = stakingRewardsByVault[`${chainId}:${address.toLowerCase()}`];
  if (!config) return undefined;

  return {
    ...config,
    netYieldPercent:
      config.grossYieldPercent * (1 - config.operatorFeePercent / 100),
  };
};

export interface IStakingPerformance {
  /** Annualised return, as a fraction — the same shape as calculateAPR. */
  apr: number;
  /** Return since inception, as a fraction. Undefined before the vault opens. */
  cumulativeReturn?: number;
}

/**
 * The return figures a staking vault should report, derived from its configured
 * yield rather than from a share price that never moves.
 *
 * Undefined for every other vault, which is the signal to fall back to the
 * measured numbers. Both the vault page and the Discover table read this, so
 * the same vault cannot show one return in the list and another on its page.
 */
export const resolveStakingPerformance = (
  chainId?: ChainId | string,
  address?: string,
  inceptionTimestampSec?: number,
): IStakingPerformance | undefined => {
  const config = resolveStakingRewards(chainId, address);
  if (!config) return undefined;

  const apr = config.netYieldPercent / 100;

  // Straight yield x time open, not compounded: the rewards leave in another
  // token the moment they are earned, so they never grow this position. It is
  // also the arithmetic the vault chart's yield line draws, so the number and
  // the line agree.
  const yearsRunning = inceptionTimestampSec
    ? (Date.now() / 1000 - inceptionTimestampSec) / (365 * 24 * 60 * 60)
    : 0;

  return {
    apr,
    cumulativeReturn: yearsRunning > 0 ? apr * yearsRunning : undefined,
  };
};
