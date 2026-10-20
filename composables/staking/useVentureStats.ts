import { emissionSchedule, tierAt } from "./ventureStaking";
import {
  VENTURE_STAKING,
  VENTURE_STAKING_ASSETS,
  VENTURE_STAKING_PREVIEW,
  VENTURE_STAKING_VAULT,
  type VentureAsset,
  type VentureTier,
} from "./ventureStakingConfig";
import { useVenturePool } from "./useVenturePool";

export interface VentureProgramStats {
  /** All deposits at ETH value; what the tiers fill against. */
  stakedEth: number;
  stakedUsd: number;
  holdings: Record<VentureAsset["symbol"], number>;
  yieldGeneratedEth: number | null;
  yieldGeneratedUsd: number | null;
  refiDistributed: number | null;
  /** REFI emitted per second right now, for the live counters. */
  refiPerSecond: number;
  stakers: number | null;
  daysLive: number | null;
  /** Month of the program we are in, 0-based; null before launch. */
  currentMonth: number | null;
}

export interface VenturePosition {
  symbol: VentureAsset["symbol"];
  amount: number;
  amountUsd: number;
  tier: VentureTier;
  yieldRedirected: number;
  refiEarned: number;
  refiPerSecond: number;
  /** Share of this month's emission the position takes. */
  share: number;
}

const SECONDS_PER_MONTH = (365 / 12) * 24 * 3600;
const priceOf = (symbol: VentureAsset["symbol"]) =>
  VENTURE_STAKING_ASSETS.find((asset) => asset.symbol === symbol)?.priceUsd ?? 0;

/**
 * Everything the staking page shows about the program and the visitor's
 * position. Until the vault is deployed it serves VENTURE_STAKING_PREVIEW
 * with `isPreview` set; afterwards the pool comes from the vault and the
 * figures without a source yet read null (rendered as dashes).
 */
export const useVentureStats = () => {
  const isPreview = !VENTURE_STAKING_VAULT.address;
  const { livePoolEth } = useVenturePool();
  const schedule = emissionSchedule();

  const program = computed<VentureProgramStats>(() => {
    if (!isPreview) {
      return {
        stakedEth: livePoolEth.value,
        stakedUsd: livePoolEth.value * VENTURE_STAKING.ethPriceUsd,
        holdings: { ETH: livePoolEth.value, WBTC: 0, USDC: 0 },
        // TODO: per-asset holdings, yield, REFI distributed, stakers and the
        // launch date need the vault's events or a backend index.
        yieldGeneratedEth: null,
        yieldGeneratedUsd: null,
        refiDistributed: null,
        refiPerSecond: schedule[0] / SECONDS_PER_MONTH,
        stakers: null,
        daysLive: null,
        currentMonth: null,
      };
    }
    const preview = VENTURE_STAKING_PREVIEW;
    const stakedUsd = (Object.keys(preview.holdings) as VentureAsset["symbol"][])
      .reduce((sum, symbol) => sum + preview.holdings[symbol] * priceOf(symbol), 0);
    const currentMonth = Math.floor(preview.daysLive / (365 / 12));
    return {
      stakedEth: stakedUsd / VENTURE_STAKING.ethPriceUsd,
      stakedUsd,
      holdings: preview.holdings,
      yieldGeneratedEth: preview.yieldGeneratedEth,
      yieldGeneratedUsd: preview.yieldGeneratedEth * VENTURE_STAKING.ethPriceUsd,
      refiDistributed: preview.refiDistributed,
      refiPerSecond: schedule[currentMonth] / SECONDS_PER_MONTH,
      stakers: preview.stakers,
      daysLive: preview.daysLive,
      currentMonth,
    };
  });

  /** The pool the calculator projects against. */
  const poolEth = computed(() => (isPreview ? program.value.stakedEth : livePoolEth.value));

  const position = computed<VenturePosition | null>(() => {
    // TODO: read the connected wallet's share balance once the vault exists.
    if (!isPreview) return null;
    const { symbol, amount, yieldRedirected, refiEarned } = VENTURE_STAKING_PREVIEW.position;
    const amountUsd = amount * priceOf(symbol);
    const eth = amountUsd / VENTURE_STAKING.ethPriceUsd;
    // The sample position joined at the start, so it sits in the first tier.
    const tier = tierAt(0);
    const weighted = program.value.stakedEth * tier.baseMultiplier;
    const share = (eth * tier.baseMultiplier) / weighted;
    return {
      symbol,
      amount,
      amountUsd,
      tier,
      yieldRedirected,
      refiEarned,
      refiPerSecond: share * program.value.refiPerSecond,
      share,
    };
  });

  return { isPreview, program, poolEth, position };
};
