<template>
  <section class="tranche" aria-labelledby="tranche-title">
    <div class="tranche__head">
      <span id="tranche-title" class="tranche__eyebrow">Now filling</span>
      <span class="tranche__chip">
        <span class="tranche__pulse" aria-hidden="true" />
        {{ current.tier.name }} tier · {{ current.tier.baseMultiplier }}x
      </span>
    </div>

    <div class="tranche__figure">
      <span class="tranche__filled">{{ formatUsdCompact(current.filledUsd) }}</span>
      <span class="tranche__capacity">
        <template v-if="isFinite(current.tier.capacityUsd)">
          / {{ formatUsdCompact(current.tier.capacityUsd) }}
        </template>
        <template v-else>
          deposited
        </template>
      </span>
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
        :style="{ width: `${segment.width}%`, background: `var(--asset-${segment.symbol.toLowerCase()})` }"
      />
    </div>

    <ul class="tranche__legend" aria-label="Deposits by asset">
      <li v-for="segment in segments" :key="segment.symbol">
        <span class="tranche__swatch" :style="{ background: `var(--asset-${segment.symbol.toLowerCase()})` }" />
        {{ segment.symbol }}
        <span class="tranche__legend-usd">{{ formatUsdCompact(segment.usd) }}</span>
      </li>
    </ul>

    <p class="tranche__note">
      <template v-if="next">
        {{ formatUsdCompact(current.tier.capacityUsd - current.filledUsd) }} left at
        {{ current.tier.baseMultiplier }}x. Then {{ next.tier.name }} at {{ next.tier.baseMultiplier }}x.
      </template>
      <template v-else>
        Every bonus tier is full; new deposits earn 1x.
      </template>
    </p>

    <ol class="tranche__tiers" aria-label="All tiers">
      <li
        v-for="fill in fills"
        :key="fill.tier.name"
        class="tranche__tier"
        :class="{ 'tranche__tier--current': fill.isCurrent }"
      >
        <span class="tranche__tier-name">
          {{ fill.tier.name }}
          <span v-if="fill.isCurrent" class="tranche__tag tranche__tag--now">Filling now</span>
          <span v-else-if="fill.ratio >= 1" class="tranche__tag">Full</span>
        </span>
        <span class="tranche__tier-range">{{ rangeLabel(fill) }}</span>
        <span class="tranche__tier-mult">{{ fill.tier.baseMultiplier }}x</span>
        <span class="tranche__tier-bar" aria-hidden="true">
          <span :style="{ width: `${barWidth(fill)}%` }" />
        </span>
      </li>
    </ol>

    <p class="tranche__rule">
      <Icon icon="mdi:lock-outline" width="1rem" />
      <span>
        Every deposit counts at its USD value on the day it comes in. Price moves never
        push the count back, so your multiplier is locked when you deposit.
      </span>
    </p>

    <p class="tranche__fade">
      Bonuses fade: full in year one, half in year two, a quarter in year three, then 1x.
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
}>();

const currentIndex = computed(() => Math.max(props.fills.findIndex((fill) => fill.isCurrent), 0));
const current = computed(() => props.fills[currentIndex.value]);
const next = computed(() => props.fills[currentIndex.value + 1]);

const rangeLabel = ({ startUsd, tier }: TierFill) => {
  if (!Number.isFinite(tier.capacityUsd)) return `${formatUsdCompact(startUsd)} and up`;
  if (startUsd === 0) return `First ${formatUsdCompact(tier.capacityUsd)}`;
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

const barWidth = (fill: TierFill) => (fill.isCurrent ? Math.max(fill.ratio * 100, 1.5) : fill.ratio * 100);
</script>

<style scoped lang="scss">
.tranche {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.75rem 1.875rem;
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
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.625rem;
    border: 1px solid $color-cyan-line;
    border-radius: 999px;
    background: $color-cyan-tint;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-cyan-raw;
    animation: tranche-pulse 2s ease-out infinite;
  }

  &__figure {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-family: $font-mono;
  }

  &__filled {
    font-size: clamp(2.75rem, 6vw, 3.75rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: $color-title;
  }

  &__capacity {
    font-size: 1.125rem;
    color: $color-subtitle;
  }

  &__bar {
    position: relative;
    display: flex;
    gap: 2px;
    height: 10px;
    border-radius: 5px;
    background: var(--fill-2);
    overflow: hidden;

    // A slow sheen across the filled part: the tier is live.
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

    &:first-child {
      border-radius: 5px 0 0 5px;
    }

    &:last-child {
      border-radius: 0 5px 5px 0;
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
    color: $color-title;

    li {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
  }

  &__swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  &__legend-usd {
    color: $color-subtitle;
  }

  &__rule {
    display: flex;
    gap: 0.625rem;
    margin: 0;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-size: $text-xs;
    line-height: 1.5;
    color: $color-subtitle;

    :deep(svg) {
      flex-shrink: 0;
      margin-top: 0.0625rem;
      color: $color-title;
    }
  }

  &__note,
  &__fade {
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;
  }

  &__fade {
    font-size: $text-xs;
  }

  &__tiers {
    display: flex;
    flex-direction: column;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }

  &__tier {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "name mult"
      "range mult"
      "bar bar";
    column-gap: 1rem;
    row-gap: 0.25rem;
    padding: 0.875rem 0;
    border-top: 1px solid $color-line;
  }

  &__tier-name {
    grid-area: name;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
  }

  &__tag {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-subtitle;

    &--now {
      color: $color-cyan;
    }
  }

  &__tier-range {
    grid-area: range;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__tier-mult {
    grid-area: mult;
    align-self: center;
    font-family: $font-mono;
    font-size: 1.375rem;
    font-weight: 600;
    color: $color-subtitle;
  }

  &__tier--current &__tier-mult {
    color: $color-title;
  }

  &__tier-bar {
    grid-area: bar;
    height: 3px;
    margin-top: 0.5rem;
    border-radius: 2px;
    background: var(--fill-2);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      background: $color-subtitle;
    }
  }

  &__tier--current &__tier-bar span {
    background: $color-primary;
  }

  @media (max-width: $screen-sm) {
    padding: 1.5rem 1.25rem;
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
