<template>
  <div class="staking page_shell">
    <section class="staking__hero">
      <div class="staking__title-row">
        <h1 class="staking__title">
          Venture Staking
        </h1>
        <span
          v-if="isPreview"
          class="staking__preview"
          title="Sample figures until the staking vault is deployed"
        >
          Preview data
        </span>
      </div>

      <StakingHowItWorks :multiplier="currentTier.baseMultiplier" />
    </section>

    <section class="staking__main">
      <div class="staking__left">
        <StakingTrancheCard
          :fills="fills"
          :counted-by-asset="program.countedByAsset"
          :holdings="program.holdings"
          :selected="selectedAsset"
        />
        <StakingYieldSources v-model:selected="selectedAsset" :holdings="program.holdings" />
        <StakingBuybacks />
      </div>
      <aside
        class="staking__right"
        aria-label="Deposit and your position"
      >
        <StakingStakeCard
          ref="stakeCard"
          v-model:token="selectedAsset"
          :multiplier="currentTier.baseMultiplier"
          @calculate="isCalculatorOpen = true"
        />
        <StakingPositionCard :position="position" :is-connected="accountStore.isConnected" />
      </aside>
    </section>

    <StakingCalculatorDialog
      v-model="isCalculatorOpen"
      :pool-usd="poolUsd"
      :pool-yield-weight="poolYieldWeight"
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
const { isPreview, program, poolUsd, poolYieldWeight, position } = useVentureStats();
const fills = computed(() => tierFills(poolUsd.value));
const currentTier = computed(() => (fills.value.find((fill) => fill.isCurrent) ?? fills.value[0]).tier);

const isCalculatorOpen = ref(false);
/** One asset is in focus across the page: the deposit card picks it. */
const selectedAsset = ref<StakeSymbol>("ETH");
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
    gap: 1.5rem;
    padding: 2rem 0 0.5rem;
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


  &__title-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
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
    // The same size as Discover's "On-chain vaults".
    font-size: clamp(30px, 3.4vw, 44px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    color: $color-title;
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

  // The deposit stays in view while the left column scrolls, always pinned
  // by its top so the Deposit header never slides under the navbar.
  &__right {
    position: sticky;
    top: calc(#{$navbar-height} + 1rem);
    gap: 1.25rem;

    :deep(.brand_card) {
      padding: 1.375rem 1.5rem;
    }

    @media (max-width: $screen-lg) {
      position: static;
    }

    // Short windows: tighten both cards so the whole column still fits.
    @media (max-height: 820px) and (min-width: $screen-lg) {
      gap: 0.75rem;

      :deep(.brand_card) {
        padding: 1rem 1.25rem;
      }

      :deep(.stake) {
        gap: 0.625rem;
      }

      :deep(.stake__deposit) {
        padding: 0.625rem 0.875rem;
      }

      :deep(.stake__amount) {
        font-size: 1.75rem;
      }

      :deep(.stake__row) {
        padding: 0.4375rem 0;
      }

      :deep(.position) {
        gap: 0.625rem;
      }

      :deep(.position__refi) {
        font-size: 1.625rem;
      }

      :deep(.position__row) {
        padding: 0.375rem 0;
      }
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
