<template>
  <section class="ladder brand_card" aria-labelledby="ladder-title">
    <span id="ladder-title" class="brand_card__eyebrow">Tiers</span>
    <p class="ladder__intro">
      Tiers fill in deposit order. The earlier you stake, the higher your multiplier.
    </p>

    <ol class="ladder__list">
      <li
        v-for="fill in fills"
        :key="fill.tier.name"
        class="ladder__row"
        :class="{ 'ladder__row--current': fill.isCurrent }"
      >
        <div class="ladder__name">
          <span>{{ fill.tier.name }}</span>
          <span v-if="fill.isCurrent" class="ladder__now">Filling now</span>
          <span v-else-if="fill.ratio >= 1" class="ladder__full">Full</span>
        </div>
        <span class="ladder__range">{{ rangeLabel(fill) }}</span>
        <span class="ladder__mult">{{ fill.tier.baseMultiplier }}x</span>
        <span class="ladder__bar" aria-hidden="true">
          <span :style="{ width: `${barWidth(fill)}%` }" />
        </span>
      </li>
    </ol>

    <p class="ladder__fade">
      Bonuses fade over time: full in year one, half in year two, a quarter in year three, then 1x.
    </p>
  </section>
</template>

<script setup lang="ts">
import { formatInt } from "~/composables/staking/formatStaking";
import type { TierFill } from "~/composables/staking/ventureStaking";

defineProps<{ fills: TierFill[] }>();

const rangeLabel = ({ startEth, tier }: TierFill) => {
  if (!Number.isFinite(tier.capacityEth)) return `${formatInt(startEth)} ETH and up`;
  if (startEth === 0) return `First ${formatInt(tier.capacityEth)} ETH`;
  return `${formatInt(startEth)} to ${formatInt(startEth + tier.capacityEth)} ETH`;
};

/** The open tier has no capacity; it reads empty until it starts filling. */
const barWidth = (fill: TierFill) => (fill.isCurrent ? Math.max(fill.ratio * 100, 1.5) : fill.ratio * 100);
</script>

<style scoped lang="scss">
.ladder {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__intro,
  &__fade {
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;
  }

  &__fade {
    font-size: $text-xs;
  }

  &__list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__row {
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

    &:last-child {
      border-bottom: 1px solid $color-line;
    }
  }

  &__name {
    grid-area: name;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
  }

  &__now,
  &__full {
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__now {
    color: $color-cyan;
  }

  &__full {
    color: $color-subtitle;
  }

  &__range {
    grid-area: range;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__mult {
    grid-area: mult;
    align-self: center;
    font-family: $font-mono;
    font-size: 1.5rem;
    font-weight: 600;
    color: $color-subtitle;
  }

  &__row--current &__mult {
    color: $color-title;
  }

  &__bar {
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

  &__row--current &__bar span {
    background: $color-primary;
  }
}
</style>
