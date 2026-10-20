<template>
  <section class="tranche" aria-labelledby="tranche-title">
    <div class="tranche__head">
      <span id="tranche-title" class="tranche__eyebrow">
        <span class="tranche__pulse" aria-hidden="true" />Now staked
      </span>
      <span class="tranche__total">
        {{ formatUsdCompact(totalUsd) }}<template v-if="hasCapacity"> of {{ formatUsdCompact(stageEndUsd) }}</template>
      </span>
    </div>

    <div class="tranche__offer">
      <span class="tranche__mult">{{ current.tier.baseMultiplier }}x</span>
      <span class="tranche__offer-text">points if you stake now</span>
      <span class="tranche__stage">{{ current.tier.name }} stage</span>
    </div>

    <template v-if="hasCapacity">
      <div
        class="tranche__bar"
        role="progressbar"
        :aria-valuenow="Math.round(current.ratio * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${current.tier.name} stage claimed`"
      >
        <span
          v-for="segment in segments"
          :key="segment.symbol"
          class="tranche__segment"
          :class="{ 'tranche__segment--dim': segment.symbol !== selected }"
          :style="{ width: `${segment.width}%`, background: `var(--asset-${segment.symbol.toLowerCase()})` }"
        />
      </div>

      <div class="tranche__foot">
        <span>
          <strong>{{ Math.floor(current.ratio * 100) }}% claimed</strong>
          · {{ formatUsdCompact(current.tier.capacityUsd - current.filledUsd) }} left at {{ current.tier.baseMultiplier }}x
        </span>
        <span v-if="later.length" class="tranche__later">
          then
          <span v-for="(fill, index) in later" :key="fill.tier.name" class="tranche__step">
            <Icon
              v-if="index"
              icon="mdi:arrow-right"
              width="0.8rem"
              class="tranche__arrow"
            />
            {{ fill.tier.baseMultiplier }}x
          </span>
        </span>
      </div>
    </template>

    <p v-else class="tranche__foot">
      Every bonus stage is full; new stakes earn the base rate.
    </p>

    <ul class="tranche__assets" aria-label="Staked by asset">
      <li
        v-for="row in assetRows"
        :key="row.symbol"
        class="tranche__asset"
        :class="{ 'tranche__asset--active': row.symbol === selected }"
      >
        <span class="tranche__swatch" :style="{ background: `var(--asset-${row.symbol.toLowerCase()})` }" />
        <IconChain v-if="row.symbol === 'ETH'" chain-short="eth" :size="16" />
        <IconBaseAsset v-else :symbol="row.symbol" :size="16" />
        <span class="tranche__asset-amount">{{ row.amountLabel }} {{ row.symbol }}</span>
        <span class="tranche__asset-usd">{{ formatUsdCompact(row.usd) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { formatAmount, formatCompact, formatUsdCompact } from "~/composables/staking/formatStaking";
import type { TierFill } from "~/composables/staking/ventureStaking";
import { VENTURE_STAKING_ASSETS, type VentureAsset } from "~/composables/staking/ventureStakingConfig";

type AssetSymbol = VentureAsset["symbol"];

const props = defineProps<{
  fills: TierFill[];
  /** Deposit-time USD by asset; splits the bar into its sources. */
  countedByAsset: Record<AssetSymbol, number>;
  /** Amounts staked, in each asset's own units. */
  holdings: Record<AssetSymbol, number>;
  /** The asset picked in the deposit card; its share stands out. */
  selected: AssetSymbol;
}>();

const currentIndex = computed(() => Math.max(props.fills.findIndex((fill) => fill.isCurrent), 0));
const current = computed(() => props.fills[currentIndex.value]);
/** The stages after this one; only their multipliers are shown. */
const later = computed(() => props.fills.slice(currentIndex.value + 1));

const hasCapacity = computed(() => Number.isFinite(current.value.tier.capacityUsd));
const totalUsd = computed(() => current.value.startUsd + current.value.filledUsd);
const stageEndUsd = computed(() => current.value.startUsd + current.value.tier.capacityUsd);

/** The claimed part of the bar, split by each asset's share of everything counted. */
const segments = computed(() => {
  const symbols = Object.keys(props.countedByAsset) as AssetSymbol[];
  const total = symbols.reduce((sum, symbol) => sum + props.countedByAsset[symbol], 0);
  return symbols
    .filter((symbol) => props.countedByAsset[symbol] > 0)
    .map((symbol) => ({
      symbol,
      width: total > 0 ? Math.max(current.value.ratio, 0.01) * 100 * (props.countedByAsset[symbol] / total) : 0,
    }));
});

const assetRows = computed(() =>
  VENTURE_STAKING_ASSETS.map((asset) => {
    const amount = props.holdings[asset.symbol] ?? 0;
    return {
      symbol: asset.symbol,
      amountLabel: asset.symbol === "USDC" ? formatCompact(amount) : formatAmount(amount, 2),
      usd: props.countedByAsset[asset.symbol] ?? 0,
    };
  }),
);
</script>

<style scoped lang="scss">
.tranche {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.5rem 1.75rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-surface;
  box-shadow: var(--shadow-card);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__eyebrow {
    @include card-title;
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
  }

  &__pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-cyan-raw;
    animation: tranche-pulse 2s ease-out infinite;
  }

  &__total {
    font-family: $font-mono;
    font-size: $text-sm;
    color: $color-subtitle;
  }

  &__offer {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
  }

  &__mult {
    font-family: $font-mono;
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: $color-cyan;
  }

  &__offer-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: $color-title;
  }

  &__stage {
    margin-left: auto;
    font-size: $text-sm;
    color: $color-subtitle;
  }

  &__bar {
    display: flex;
    gap: 2px;
    height: 10px;
    border-radius: 5px;
    background: var(--fill-2);
    overflow: hidden;
  }

  &__segment {
    display: block;
    height: 100%;
    transition: opacity $default-transition-time;

    &--dim {
      opacity: 0.4;
    }
  }

  &__assets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0.125rem 0 0;
    padding: 0.875rem 0 0;
    border-top: 1px solid $color-line;
    list-style: none;

    @media (max-width: $screen-sm) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__asset {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
    transition: color $default-transition-time;
  }

  &__asset--active {
    color: $color-title;
  }

  &__swatch {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  &__asset-amount {
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
    white-space: nowrap;
  }

  &__asset-usd {
    white-space: nowrap;
  }

  &__foot {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.375rem 1rem;
    margin: 0;
    font-size: $text-sm;
    color: $color-subtitle;

    strong {
      font-weight: 600;
      color: $color-title;
    }
  }

  &__later {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: $font-mono;
  }

  &__step {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__arrow {
    opacity: 0.6;
  }

  @media (max-width: $screen-sm) {
    padding: 1.25rem;

    &__mult {
      font-size: 2.5rem;
    }

    &__stage {
      margin-left: 0;
    }
  }
}

@keyframes tranche-pulse {
  0% { box-shadow: 0 0 0 0 $color-cyan-glow; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .tranche__pulse {
    animation: none;
  }
}
</style>
