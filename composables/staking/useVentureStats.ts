import { emissionSchedule, tierAt, weightedPool } from "./ventureStaking";
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
  /** What the deposits are worth today. */
  stakedUsd: number;
  /**
   * Deposits at their USD value on the day they came in. This is what fills
   * the tiers: it only grows, so a price drop never reopens a filled tier.
   */
  countedUsd: number;
  /** countedUsd split by asset, for the tier bar. */
  countedByAsset: Record<VentureAsset["symbol"], number>;
  holdings: Record<VentureAsset["symbol"], number>;
  /** Yield reinvested so far across all assets, in USD. */
  yieldGeneratedUsd: number | null;
  refiDistributed: number | null;
  /** Points emitted per second right now, for the live counters. */
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
  yieldRedirectedUsd: number;
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
      const usd = livePoolEth.value * VENTURE_STAKING.ethPriceUsd;
      return {
        stakedUsd: usd,
        // TODO: the deposit-time count needs each deposit's USD value at the
        // time (vault events plus a price at that block, or a backend index).
        countedUsd: usd,
        countedByAsset: { ETH: usd, WBTC: 0, USDC: 0 },
        holdings: { ETH: livePoolEth.value, WBTC: 0, USDC: 0 },
        // TODO: WBTC/USDC holdings, yield, points distributed, stakers and the
        // launch date need the vault's events or a backend index.
        yieldGeneratedUsd: null,
        refiDistributed: null,
        refiPerSecond: schedule[0] / SECONDS_PER_MONTH,
        stakers: null,
        daysLive: null,
        currentMonth: null,
      };
    }
    const preview = VENTURE_STAKING_PREVIEW;
    const symbols = Object.keys(preview.holdings) as VentureAsset["symbol"][];
    // The sample assumes prices have not moved since deposit, so today's value
    // and the deposit-time count agree.
    const countedByAsset = Object.fromEntries(
      symbols.map((symbol) => [symbol, preview.holdings[symbol] * priceOf(symbol)]),
    ) as Record<VentureAsset["symbol"], number>;
    const stakedUsd = symbols.reduce((sum, symbol) => sum + countedByAsset[symbol], 0);
    const currentMonth = Math.floor(preview.daysLive / (365 / 12));
    return {
      stakedUsd,
      countedUsd: stakedUsd,
      countedByAsset,
      holdings: preview.holdings,
      yieldGeneratedUsd: preview.yieldGeneratedUsd,
      refiDistributed: preview.refiDistributed,
      refiPerSecond: schedule[currentMonth] / SECONDS_PER_MONTH,
      stakers: preview.stakers,
      daysLive: preview.daysLive,
      currentMonth,
    };
  });

  /** What fills the tiers and what the calculator projects against. */
  const poolUsd = computed(() => program.value.countedUsd);

  const position = computed<VenturePosition | null>(() => {
    // TODO: read the connected wallet's share balance once the vault exists.
    if (!isPreview) return null;
    const { symbol, amount, yieldRedirected, refiEarned } = VENTURE_STAKING_PREVIEW.position;
    const amountUsd = amount * priceOf(symbol);
    // The sample position joined at the start, so it sits in the first tier.
    const tier = tierAt(0);
    const share = (amountUsd * tier.baseMultiplier) / weightedPool(poolUsd.value, 0);
    return {
      symbol,
      amount,
      amountUsd,
      tier,
      yieldRedirected,
      yieldRedirectedUsd: yieldRedirected * priceOf(symbol),
      refiEarned,
      refiPerSecond: share * program.value.refiPerSecond,
      share,
    };
  });

  return { isPreview, program, poolUsd, position };
};
