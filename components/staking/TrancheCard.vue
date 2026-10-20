<template>
  <section class="tranche" aria-labelledby="tranche-title">
    <span id="tranche-title" class="tranche__eyebrow">
      <span class="tranche__pulse" aria-hidden="true" />Now filling
    </span>

    <div class="tranche__summary">
      <div class="tranche__figure">
        <span class="tranche__filled">{{ formatUsdCompact(current.filledUsd) }}</span>
        <span v-if="isFinite(current.tier.capacityUsd)" class="tranche__capacity">
          / {{ formatUsdCompact(current.tier.capacityUsd) }}
        </span>
      </div>
      <p class="tranche__note">
        <template v-if="next">
          <strong>{{ formatUsdCompact(current.tier.capacityUsd - current.filledUsd) }}</strong> left at
          {{ current.tier.baseMultiplier }}x, then {{ next.tier.name }} at {{ next.tier.baseMultiplier }}x
        </template>
        <template v-else>
          Every bonus tier is full
        </template>
      </p>
    </div>

    <div
      v-if="isFinite(current.tier.capacityUsd)"
      class="tranche__bar"
      role="progressbar"
      :aria-valuenow="Math.round(current.filledUsd)"
      aria-valuemin="0"
      :aria-valuemax="current.tier.capacityUsd"
      :aria-label="`${current.tier.name} tier filled, in USD`"
    >
      <span
        v-for="segment in segments"
        :key="segment.symbol"
        class="tranche__segment"
        :class="{ 'tranche__segment--dim': segment.symbol !== selected }"
        :style="{ width: `${segment.width}%`, background: `var(--asset-${segment.symbol.toLowerCase()})` }"
      />
    </div>

    <ul class="tranche__legend" aria-label="Deposits by asset">
      <li
        v-for="segment in segments"
        :key="segment.symbol"
        :class="{ 'tranche__legend--active': segment.symbol === selected }"
      >
        <span class="tranche__swatch" :style="{ background: `var(--asset-${segment.symbol.toLowerCase()})` }" />
        {{ segment.symbol }}
        <span class="tranche__legend-usd">{{ formatUsdCompact(segment.usd) }}</span>
      </li>
    </ul>

    <ol class="tranche__tiers" aria-label="All tiers">
      <li
        v-for="fill in fills"
        :key="fill.tier.name"
        class="tranche__tier"
        :class="{ 'tranche__tier--current': fill.isCurrent }"
      >
        <span class="tranche__tier-top">
          <span class="tranche__tier-name">{{ fill.tier.name }}</span>
          <span class="tranche__tier-mult">{{ fill.tier.baseMultiplier }}x</span>
        </span>
        <span class="tranche__tier-range">{{ rangeLabel(fill) }}</span>
      </li>
    </ol>

    <p class="tranche__fine">
      <Icon icon="mdi:lock-outline" width="0.875rem" />
      Your multiplier locks in when you deposit.
    </p>
  </section>
</template>

<script setup lang="ts">
import { formatUsdCompact } from "~/composables/staking/formatStaking";
import type { TierFill } from "~/composables/staking/ventureStaking";
import type { VentureAsset } from "~/composables/staking/ventureStakingConfig";

type AssetSymbol = VentureAsset["symbol"];

const props = defineProps<{
  fills: TierFill[];
  /** Deposit-time USD by asset; splits the bar into its sources. */
  countedByAsset: Record<AssetSymbol, number>;
  /** The asset picked in the deposit card; its share stands out. */
  selected: AssetSymbol;
}>();

const currentIndex = computed(() => Math.max(props.fills.findIndex((fill) => fill.isCurrent), 0));
const current = computed(() => props.fills[currentIndex.value]);
const next = computed(() => props.fills[currentIndex.value + 1]);

const rangeLabel = ({ startUsd, tier }: TierFill) => {
  if (!Number.isFinite(tier.capacityUsd)) return `${formatUsdCompact(startUsd)}+`;
  return `${formatUsdCompact(startUsd)} to ${formatUsdCompact(startUsd + tier.capacityUsd)}`;
};


/**
 * The current tier's fill split by asset, in proportion to each asset's
 * share of everything counted so far.
 */
const segments = computed(() => {
  const symbols = Object.keys(props.countedByAsset) as AssetSymbol[];
  const total = symbols.reduce((sum, symbol) => sum + props.countedByAsset[symbol], 0);
  return symbols
    .filter((symbol) => props.countedByAsset[symbol] > 0)
    .map((symbol) => ({
      symbol,
      usd: props.countedByAsset[symbol],
      width: total > 0 ? current.value.ratio * 100 * (props.countedByAsset[symbol] / total) : 0,
    }));
});
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

  &__summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }

  &__figure {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-family: $font-mono;
  }

  &__filled {
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: $color-title;
  }

  &__capacity {
    font-size: 1rem;
    color: $color-subtitle;
  }

  &__note {
    margin: 0;
    font-size: $text-sm;
    color: $color-subtitle;

    strong {
      font-family: $font-mono;
      font-weight: 600;
      color: $color-title;
    }
  }

  &__bar {
    position: relative;
    display: flex;
    gap: 2px;
    height: 10px;
    border-radius: 5px;
    background: var(--fill-2);
    overflow: hidden;

    // A slow sheen across the bar: the tier is live.
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(100deg, transparent 30%, var(--sheen) 50%, transparent 70%);
      transform: translateX(-100%);
      animation: tranche-sheen 3.5s ease-in-out infinite;
      pointer-events: none;
    }
  }

  &__segment {
    display: block;
    height: 100%;
    transition: opacity $default-transition-time;

    &--dim {
      opacity: 0.3;
    }
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;

    li {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: color $default-transition-time;
    }
  }

  &__legend--active {
    color: $color-title;
    font-weight: 600;
  }

  &__swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  &__legend-usd {
    font-weight: 400;
    color: $color-subtitle;
  }

  &__tiers {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0.25rem 0 0;
    padding: 0;
    list-style: none;

    @media (max-width: $screen-sm) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__tier {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;

    &--current {
      border-color: $color-cyan-line;
    }
  }

  &__tier-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__tier-name {
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
  }

  &__tier-mult {
    font-family: $font-mono;
    font-size: $text-md;
    font-weight: 600;
    color: $color-subtitle;
  }

  &__tier--current &__tier-mult {
    color: $color-cyan;
  }

  &__tier-range {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-subtitle;
  }



  &__fine {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: $text-xs;
    line-height: 1.5;
    color: $color-subtitle;

    :deep(svg) {
      flex-shrink: 0;
    }
  }

  @media (max-width: $screen-sm) {
    padding: 1.25rem;

    &__fine {
      align-items: flex-start;
    }
  }
}

@keyframes tranche-pulse {
  0% { box-shadow: 0 0 0 0 $color-cyan-glow; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

@keyframes tranche-sheen {
  0% { transform: translateX(-100%); }
  60%, 100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .tranche__pulse,
  .tranche__bar::after {
    animation: none;
  }
}
</style>
