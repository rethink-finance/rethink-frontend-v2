<template>
  <div class="staking page_shell">
    <header class="staking__hero">
      <span class="staking__eyebrow">Venture staking</span>
      <!-- Placeholder copy until the final staking narrative is in. -->
      <h1 class="staking__title">
        Keep your ETH.<br>
        <span class="staking__title-accent">Stake its future.</span>
      </h1>
      <p class="staking__lede">
        Route your staking yield to the Rethink treasury and earn REFI from the
        first block. Your principal never moves: it stays in a non-custodial
        vault you can leave at any settlement cycle.
      </p>
    </header>

    <div class="staking__grid">
      <StakingStakeCard ref="stakeCard" class="staking__stake" />
      <StakingVentureCalculator
        :live-pool-eth="livePoolEth"
        @stake="onCalculatorStake"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVenturePool } from "~/composables/staking/useVenturePool";

const { livePoolEth } = useVenturePool();
const stakeCard = ref<{ prefill: (eth: number) => void; $el: HTMLElement }>();

const onCalculatorStake = (eth: number) => {
  if (!stakeCard.value) return;
  stakeCard.value.$el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  if (Number.isFinite(eth) && eth > 0) stakeCard.value.prefill(eth);
};
</script>

<style scoped lang="scss">
.staking {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 44rem;
    margin-top: calc(1rem + 4px);
  }

  &__eyebrow {
    @include card-title;
    color: $color-cyan;
  }

  &__title {
    margin: 0;
    font-size: clamp(2.25rem, 6vw, 3.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: $color-title;
  }

  &__title-accent {
    background: $gradient-brand;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__lede {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.6;
    color: $color-subtitle;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
    align-items: start;
    gap: 2rem;

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__stake {
    position: sticky;
    top: calc(#{$navbar-height} + 1.5rem);

    @media (max-width: $screen-lg) {
      position: static;
    }
  }
}
</style>
