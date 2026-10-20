<template>
  <div class="staking page_shell">
    <header class="staking__hero">
      <!-- Placeholder copy until the final staking narrative is in. -->
      <h1 class="staking__title">
        Staking
      </h1>
      <p class="staking__lede">
        Stake ETH, WBTC or USDC and earn REFI. Your deposit stays in a
        non-custodial vault you can exit any settlement cycle; only its yield
        goes to the Rethink treasury.
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
import type { VentureAsset } from "~/composables/staking/ventureStakingConfig";

const { livePoolEth } = useVenturePool();
type StakeSymbol = VentureAsset["symbol"];
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
  gap: 2.5rem;

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 44rem;
    margin-top: calc(1rem + 4px);
  }

  &__title {
    margin: 0;
    font-size: 44px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    color: $color-title;
  }

  &__lede {
    margin: 0;
    font-size: $text-md;
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
