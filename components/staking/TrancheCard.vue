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
      <span class="tranche__filled">{{ formatInt(current.filledEth) }}</span>
      <span class="tranche__capacity">
        <template v-if="isFinite(current.tier.capacityEth)">
          / {{ formatInt(current.tier.capacityEth) }} ETH
        </template>
        <template v-else>ETH</template>
      </span>
    </div>

    <div
      v-if="isFinite(current.tier.capacityEth)"
      class="tranche__bar"
      role="progressbar"
      :aria-valuenow="Math.round(current.filledEth)"
      aria-valuemin="0"
      :aria-valuemax="current.tier.capacityEth"
      :aria-label="`${current.tier.name} tier filled`"
    >
      <span :style="{ width: `${Math.max(current.ratio * 100, 1)}%` }" />
    </div>

    <p class="tranche__note">
      <template v-if="next">
        {{ formatInt(current.tier.capacityEth - current.filledEth) }} ETH left at
        {{ current.tier.baseMultiplier }}x. After that, deposits enter the {{ next.tier.name }} tier at
        {{ next.tier.baseMultiplier }}x.
      </template>
      <template v-else>
        Every tier above the open tier is full; new deposits earn the base rate.
      </template>
    </p>

    <ol class="tranche__steps" aria-label="All tiers">
      <li
        v-for="fill in fills"
        :key="fill.tier.name"
        class="tranche__step"
        :class="{ 'tranche__step--current': fill.isCurrent, 'tranche__step--full': fill.ratio >= 1 && !fill.isCurrent }"
      >
        <span class="tranche__step-bar"><span :style="{ width: `${fill.ratio * 100}%` }" /></span>
        <span class="tranche__step-label">{{ fill.tier.name }} {{ fill.tier.baseMultiplier }}x</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { formatInt } from "~/composables/staking/formatStaking";
import type { TierFill } from "~/composables/staking/ventureStaking";

const props = defineProps<{ fills: TierFill[] }>();

const currentIndex = computed(() => Math.max(props.fills.findIndex((fill) => fill.isCurrent), 0));
const current = computed(() => props.fills[currentIndex.value]);
const next = computed(() => props.fills[currentIndex.value + 1]);
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
  }

  &__pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-cyan-raw;
    box-shadow: 0 0 0 0 $color-cyan-glow;
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
    height: 8px;
    border-radius: 4px;
    background: var(--fill-2);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      border-radius: 4px;
      background: $gradient-brand;
    }
  }

  &__note {
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;
  }

  &__steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    margin: 0.25rem 0 0;
    padding: 1rem 0 0;
    border-top: 1px solid $color-line;
    list-style: none;
  }

  &__step {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  &__step-bar {
    height: 3px;
    border-radius: 2px;
    background: var(--fill-2);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      background: $color-subtitle;
    }
  }

  &__step--current &__step-bar span {
    background: $color-primary;
  }

  &__step-label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: $color-subtitle;
    white-space: nowrap;
  }

  &__step--current &__step-label {
    color: $color-title;
  }

  @media (max-width: $screen-sm) {
    padding: 1.5rem 1.25rem;

    &__steps {
      grid-template-columns: repeat(2, 1fr);
      row-gap: 0.875rem;
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
