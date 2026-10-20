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
          <ul class="staking__flex" aria-label="Program guarantees">
            <li class="staking__flex-item staking__flex-item--accent">
              <Icon icon="mdi:fire" width="1rem" />100% of revenue buys back REFI
            </li>
            <li class="staking__flex-item">
              <Icon icon="mdi:scale-balance" width="1rem" />No leverage
            </li>
            <li class="staking__flex-item">
              <Icon icon="mdi:link-variant-off" width="1rem" />No bridges
            </li>
            <li class="staking__flex-item">
              <Icon icon="mdi:layers-off-outline" width="1rem" />No restaking
            </li>
          </ul>
        </div>

        <StakingHowItWorks
          class="staking__how"
          :multiplier="currentTier.baseMultiplier"
          :tier-name="currentTier.name"
        />
      </div>
    </section>

    <section class="staking__main">
      <div class="staking__left">
        <StakingTrancheCard
          :fills="fills"
          :counted-by-asset="program.countedByAsset"
          :selected="selectedAsset"
        />
        <StakingYieldSources v-model:selected="selectedAsset" :holdings="program.holdings" />
        <StakingBuybacks />
        <StakingEmissionChart :current-month="program.currentMonth" />
      </div>
      <aside
        ref="aside"
        class="staking__right"
        aria-label="Deposit and your position"
        :style="{ top: `${stickyTop}px` }"
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
/** One asset is in focus across the page: the deposit card picks it. */
const selectedAsset = ref<StakeSymbol>("ETH");
const stakeCard = ref<{ prefill: (symbol: StakeSymbol, amount: number) => void; $el: HTMLElement }>();

/**
 * Sticky offset for the deposit column. It pins under the navbar when it
 * fits the window; when it is taller, the offset goes negative so it scrolls
 * until its bottom is in view and pins there. Nothing is ever cut off and the
 * column never scrolls on its own.
 */
const NAVBAR_PX = 64;
const STICKY_GAP_PX = 24;
const aside = ref<HTMLElement>();
const stickyTop = ref(NAVBAR_PX + STICKY_GAP_PX);
const updateStickyTop = () => {
  const height = aside.value?.offsetHeight ?? 0;
  stickyTop.value = Math.min(NAVBAR_PX + STICKY_GAP_PX, window.innerHeight - height - STICKY_GAP_PX);
};
let asideObserver: ResizeObserver | undefined;
onMounted(() => {
  updateStickyTop();
  asideObserver = new ResizeObserver(updateStickyTop);
  if (aside.value) asideObserver.observe(aside.value);
  window.addEventListener("resize", updateStickyTop);
});
onUnmounted(() => {
  asideObserver?.disconnect();
  window.removeEventListener("resize", updateStickyTop);
});

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

  &__flex {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  &__flex-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.875rem 0.4375rem 0.6875rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    background: $color-surface;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;

    :deep(svg) {
      color: $color-subtitle;
    }

    &--accent {
      border-color: $color-cyan-line;
      background:
        linear-gradient($color-cyan-tint, $color-cyan-tint),
        $color-surface;
      color: $color-cyan;

      :deep(svg) {
        color: $color-cyan;
      }
    }
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

  // The deposit stays in view while the left column scrolls; the offset
  // comes from updateStickyTop.
  &__right {
    position: sticky;
    gap: 1.25rem;

    :deep(.brand_card) {
      padding: 1.375rem 1.5rem;
    }

    @media (max-width: $screen-lg) {
      position: static;
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
