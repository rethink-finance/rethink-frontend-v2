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
            The earlier you stake, the more points you earn.
          </p>
        </div>

        <StakingHowItWorks
          class="staking__how"
          :multiplier="currentTier.baseMultiplier"
          :tier-name="currentTier.name"
        />
      </div>
    </section>

    <StakingProgramStats :program="program" />

    <section class="staking__main">
      <div class="staking__left">
        <StakingTrancheCard :fills="fills" :counted-by-asset="program.countedByAsset" />
        <StakingYieldSources :holdings="program.holdings" />
        <StakingEmissionChart :current-month="program.currentMonth" />
      </div>
      <aside class="staking__right" aria-label="Deposit and your position">
        <StakingStakeCard
          ref="stakeCard"
          :multiplier="currentTier.baseMultiplier"
          @calculate="isCalculatorOpen = true"
        />
        <StakingPositionCard :position="position" :is-connected="accountStore.isConnected" />
      </aside>
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
    align-items: end;
    gap: 2rem 3rem;

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__how {
    padding-bottom: 0.25rem;
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

  // The deposit stays in view while the left column scrolls. On a short
  // window the column scrolls inside itself rather than losing its bottom.
  &__right {
    position: sticky;
    top: calc(#{$navbar-height} + 1.5rem);
    gap: 1.25rem;
    max-height: calc(100vh - #{$navbar-height} - 3rem);
    overflow-y: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    @media (max-width: $screen-lg) {
      position: static;
      max-height: none;
      overflow: visible;
    }
  }

  // On one column the deposit comes first: it is what the page is for.
  @media (max-width: $screen-lg) {
    &__right {
      order: -1;
    }
  }
}
</style>
