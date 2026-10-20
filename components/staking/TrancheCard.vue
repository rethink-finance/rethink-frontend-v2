<template>
  <section class="tranche" aria-labelledby="tranche-title">
    <span id="tranche-title" class="tranche__eyebrow">
      <span class="tranche__pulse" aria-hidden="true" />Now staked
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
          Every bonus stage is full
        </template>
      </p>
    </div>

    <!-- The stages as a staircase: each step as wide as the stage and as tall
         as its points multiplier. The step now filling fills by asset. -->
    <ol class="stairs" aria-label="Points multiplier by stage">
      <li
        v-for="fill in fills"
        :key="fill.tier.name"
        class="stairs__stage"
        :class="{
          'stairs__stage--current': fill.isCurrent,
          'stairs__stage--done': fill.ratio >= 1 && !fill.isCurrent,
        }"
        :style="{ flexGrow: STAGE_WIDTH[fills.indexOf(fill)] ?? 1 }"
        :aria-label="`${fill.tier.name}: ${fill.tier.baseMultiplier}x points, ${rangeLabel(fill)}`"
      >
        <div class="stairs__plot">
          <span class="stairs__mult">
            {{ fill.tier.baseMultiplier }}x<small>points</small>
          </span>
          <div class="stairs__step" :style="{ height: `calc(${fill.tier.baseMultiplier / topMultiplier} * ${STEP_MAX})` }">
            <template v-if="fill.isCurrent">
              <span
                v-for="segment in segments"
                :key="segment.symbol"
                class="stairs__segment"
                :class="{ 'stairs__segment--dim': segment.symbol !== selected }"
                :style="{ width: `${segment.width}%`, background: `var(--asset-${segment.symbol.toLowerCase()})` }"
              />
              <span class="stairs__now" :style="{ left: `${fill.ratio * 100}%` }" />
            </template>
          </div>
        </div>
        <span class="stairs__name">{{ fill.tier.name }}</span>
        <span class="stairs__range">{{ rangeLabel(fill) }}</span>
      </li>
    </ol>

    <div class="tranche__foot">
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
      <p class="tranche__fine">
        <Icon icon="mdi:lock-outline" width="0.875rem" />
        Your multiplier locks in when you deposit.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatUsdCompact } from "~/composables/staking/formatStaking";
import type { TierFill } from "~/composables/staking/ventureStaking";
import type { VentureAsset } from "~/composables/staking/ventureStakingConfig";

type AssetSymbol = VentureAsset["symbol"];

const props = defineProps<{
  fills: TierFill[];
  /** Deposit-time USD by asset; splits the step now filling into its sources. */
  countedByAsset: Record<AssetSymbol, number>;
  /** The asset picked in the deposit card; its share stands out. */
  selected: AssetSymbol;
}>();

/**
 * Relative step widths. Roughly the stages' sizes ($6M, $9M, $15M, open),
 * evened out so the smallest step still has room for its labels.
 */
const STAGE_WIDTH = [22, 25, 31, 22];

/** Height of the tallest step; the rest scale by their multiplier. */
const STEP_MAX = "6.75rem";

const currentIndex = computed(() => Math.max(props.fills.findIndex((fill) => fill.isCurrent), 0));
const current = computed(() => props.fills[currentIndex.value]);
const next = computed(() => props.fills[currentIndex.value + 1]);
const topMultiplier = computed(() => Math.max(...props.fills.map((fill) => fill.tier.baseMultiplier)));

const rangeLabel = ({ startUsd, tier }: TierFill) => {
  if (!Number.isFinite(tier.capacityUsd)) return `${formatUsdCompact(startUsd)}+`;
  return `${formatUsdCompact(startUsd)} to ${formatUsdCompact(startUsd + tier.capacityUsd)}`;
};

/** The current stage's fill split by asset, in proportion to everything counted. */
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
  gap: 1rem;
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

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
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

  &__fine {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  @media (max-width: $screen-sm) {
    padding: 1.25rem;
  }
}

.stairs {
  display: flex;
  align-items: stretch;
  gap: 4px;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;

  &__stage {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__plot {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 9rem;
  }

  &__mult {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
    margin-bottom: 0.375rem;
    font-family: $font-mono;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1;
    color: $color-subtitle;

    small {
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  }

  &__stage--current &__mult {
    color: $color-cyan;
  }

  &__step {
    position: relative;
    flex: none;
    display: flex;
    gap: 2px;
    border: 1px solid $color-line-2;
    border-bottom: 0;
    border-radius: 6px 6px 0 0;
    background: var(--fill-1);
    overflow: hidden;
  }

  &__stage--current &__step {
    border-color: $color-cyan-line;
  }

  &__stage--done &__step {
    border-color: transparent;
    background: $color-primary;
    opacity: 0.55;
  }

  &__segment {
    display: block;
    height: 100%;
    transition: opacity $default-transition-time;

    &--dim {
      opacity: 0.35;
    }
  }

  // Where the stage is filled to: a bright edge on the fill.
  &__now {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: $color-cyan-raw;
    box-shadow: 0 0 10px $color-cyan-glow;
  }

  &__name {
    margin-top: 0.375rem;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__stage--current &__name {
    color: $color-cyan;
  }

  &__range {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-subtitle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: $screen-sm) {
    &__mult {
      font-size: 1rem;

      small {
        display: none;
      }
    }

    &__range {
      font-size: 10px;
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
