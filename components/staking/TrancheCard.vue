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
        <span :style="{ width: `${Math.max(current.ratio * 100, 1)}%` }" />
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
  </section>
</template>

<script setup lang="ts">
import { formatUsdCompact } from "~/composables/staking/formatStaking";
import type { TierFill } from "~/composables/staking/ventureStaking";

const props = defineProps<{ fills: TierFill[] }>();

const currentIndex = computed(() => Math.max(props.fills.findIndex((fill) => fill.isCurrent), 0));
const current = computed(() => props.fills[currentIndex.value]);
/** The stages after this one; only their multipliers are shown. */
const later = computed(() => props.fills.slice(currentIndex.value + 1));

const hasCapacity = computed(() => Number.isFinite(current.value.tier.capacityUsd));
const totalUsd = computed(() => current.value.startUsd + current.value.filledUsd);
const stageEndUsd = computed(() => current.value.startUsd + current.value.tier.capacityUsd);
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
    height: 10px;
    border-radius: 5px;
    background: var(--fill-2);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      border-radius: 5px;
      background: $gradient-brand;
    }
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
