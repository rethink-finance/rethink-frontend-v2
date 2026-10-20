<template>
  <div class="staking page_shell">
    <section class="staking__hero">
      <div class="staking__top">
        <div class="staking__intro">
          <div class="staking__eyebrow-row">
            <span class="staking__eyebrow">Venture staking</span>
            <span
              v-if="isPreview"
              class="staking__preview"
              title="Sample figures until the staking vault is deployed"
            >
              Preview data
            </span>
          </div>
          <h1 class="staking__title">
            Staking
          </h1>
          <p class="staking__lede">
            Your principal stays preserved. Its yield is reinvested in the Rethink
            Finance ecosystem, and you earn points in return.
          </p>
        </div>

        <button type="button" class="staking__calc" @click="isCalculatorOpen = true">
          <span class="staking__calc-icon">
            <Icon icon="mdi:calculator-variant-outline" width="1.75rem" />
          </span>
          <span class="staking__calc-text">
            <span class="staking__calc-title">Calculator</span>
            <span class="staking__calc-sub">See what your stake could earn</span>
          </span>
        </button>
      </div>

      <StakingHowItWorks
        :multiplier="currentTier.baseMultiplier"
        :tier-name="currentTier.name"
      />
    </section>

    <StakingProgramStats :program="program" />

    <section class="staking__main">
      <div class="staking__left">
        <StakingTrancheCard :fills="fills" :counted-by-asset="program.countedByAsset" />
        <StakingEmissionChart :current-month="program.currentMonth" />
      </div>
      <div class="staking__right">
        <StakingStakeCard
          ref="stakeCard"
          :multiplier="currentTier.baseMultiplier"
          @calculate="isCalculatorOpen = true"
        />
        <StakingPositionCard :position="position" :is-connected="accountStore.isConnected" />
      </div>
    </section>

    <StakingCalculatorDialog
      v-model="isCalculatorOpen"
      :pool-usd="poolUsd"
      @stake="onCalculatorStake"
    />
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account/account.store";
import { useVentureStats } from "~/composables/staking/useVentureStats";
import { tierFills } from "~/composables/staking/ventureStaking";
import type { VentureAsset } from "~/composables/staking/ventureStakingConfig";

type StakeSymbol = VentureAsset["symbol"];

const accountStore = useAccountStore();
const { isPreview, program, poolUsd, position } = useVentureStats();
const fills = computed(() => tierFills(poolUsd.value));
const currentTier = computed(() => (fills.value.find((fill) => fill.isCurrent) ?? fills.value[0]).tier);

const isCalculatorOpen = ref(false);
const stakeCard = ref<{ prefill: (symbol: StakeSymbol, amount: number) => void; $el: HTMLElement }>();

const onCalculatorStake = (symbol: StakeSymbol, amount: number) => {
  if (!stakeCard.value) return;
  stakeCard.value.$el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  if (Number.isFinite(amount) && amount > 0) stakeCard.value.prefill(symbol, amount);
};
</script>

<style scoped lang="scss">
.staking {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  // The hero glow bleeds past the container; never into a sideways scroll.
  overflow-x: clip;
  padding-bottom: 2rem;

  &__hero {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2.25rem;
    padding: 3rem 0 0.5rem;
    isolation: isolate;

    // A brand glow and a faint grid behind the hero, fading out at the edges.
    &::before {
      content: "";
      position: absolute;
      inset: -4rem -50vw 0;
      z-index: -1;
      background:
        radial-gradient(40rem 20rem at 70% 30%, $color-accent-soft, transparent 70%),
        linear-gradient($color-line 1px, transparent 1px) 0 0 / 48px 48px,
        linear-gradient(90deg, $color-line 1px, transparent 1px) 0 0 / 48px 48px;
      mask-image: radial-gradient(60rem 26rem at 50% 30%, #000 30%, transparent 75%);
      pointer-events: none;
    }

    @media (max-width: $screen-md) {
      padding-top: 2rem;
    }
  }

  &__top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;

    @media (max-width: $screen-md) {
      flex-direction: column;
      align-items: stretch;
    }
  }

  &__intro {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__eyebrow-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__eyebrow {
    @include card-title;
    color: $color-cyan;
  }

  &__preview {
    padding: 0.125rem 0.5rem;
    border: 1px dashed $color-line-3;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-subtitle;
    cursor: help;
  }

  &__title {
    margin: 0;
    font-size: clamp(3.25rem, 9vw, 6rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 0.95;
    color: $color-title;
  }

  &__lede {
    max-width: 34rem;
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.6;
    color: $color-subtitle;
  }

  &__calc {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
    padding: 0.875rem 1.5rem 0.875rem 0.875rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    background: $color-surface;
    text-align: left;
    box-shadow: var(--shadow-card);
    transition: border-color $default-transition-time, background $default-transition-time;

    &:hover {
      border-color: $color-cyan;
      background:
        linear-gradient($color-cyan-tint, $color-cyan-tint),
        $color-surface;
    }

    &:focus-visible {
      outline: 2px solid $color-cyan;
      outline-offset: 2px;
    }
  }

  &__calc-icon {
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: $default-border-radius;
    background: $color-cyan-tint;
    color: $color-cyan;
  }

  &__calc-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__calc-title {
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
  }

  &__calc-sub {
    font-size: $text-sm;
    color: $color-subtitle;
  }

  &__main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
    align-items: start;
    gap: 2rem;

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__left,
  &__right {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-width: 0;
  }

  // On one column the deposit comes first: it is what the page is for.
  @media (max-width: $screen-lg) {
    &__right {
      order: -1;
    }
  }
}
</style>
