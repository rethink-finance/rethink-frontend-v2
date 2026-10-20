<template>
  <div class="staking page_shell">
    <section class="staking__hero">
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
          Stake ETH, WBTC or USDC and earn REFI every block. Your deposit stays in a
          non-custodial vault you can exit any settlement cycle; only its yield goes
          to the Rethink treasury.
        </p>
        <div class="staking__assets" aria-label="Accepted assets">
          <span class="staking__asset">
            <IconChain chain-short="eth" :size="18" />ETH
          </span>
          <span class="staking__asset">
            <IconBaseAsset symbol="WBTC" :size="18" />WBTC
          </span>
          <span class="staking__asset">
            <IconBaseAsset symbol="USDC" :size="18" />USDC
          </span>
        </div>
        <div class="staking__ctas">
          <v-btn
            color="primary"
            size="large"
            class="staking__btn"
            @click="goToStake"
          >
            Stake now
          </v-btn>
          <v-btn
            variant="outlined"
            size="large"
            class="staking__btn staking__btn--ghost"
            @click="openCalculator"
          >
            Estimate your REFI
          </v-btn>
        </div>
      </div>

      <StakingTrancheCard :fills="fills" />
    </section>

    <StakingProgramStats :program="program" />

    <section class="staking__action">
      <StakingStakeCard ref="stakeCard" />
      <div class="staking__side">
        <StakingPositionCard :position="position" :is-connected="accountStore.isConnected" />
        <section class="staking__how brand_card" aria-labelledby="how-title">
          <span id="how-title" class="brand_card__eyebrow">How it works</span>
          <ol class="staking__steps">
            <li v-for="(step, index) in steps" :key="step.title" class="staking__step">
              <span class="staking__step-index">0{{ index + 1 }}</span>
              <span class="staking__step-title">{{ step.title }}</span>
              <span class="staking__step-text">{{ step.text }}</span>
            </li>
          </ol>
        </section>
      </div>
    </section>

    <StakingVentureCalculator
      ref="calculator"
      :pool-eth="poolEth"
      @stake="onCalculatorStake"
    />

    <section class="staking__explain">
      <StakingTierLadder :fills="fills" />
      <StakingEmissionChart :current-month="program.currentMonth" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account/account.store";
import { useVentureStats } from "~/composables/staking/useVentureStats";
import { tierFills } from "~/composables/staking/ventureStaking";
import type { VentureAsset } from "~/composables/staking/ventureStakingConfig";

type StakeSymbol = VentureAsset["symbol"];

const accountStore = useAccountStore();
const { isPreview, program, poolEth, position } = useVentureStats();
const fills = computed(() => tierFills(poolEth.value));

const steps = [
  {
    title: "Deposit",
    text: "ETH, WBTC or USDC goes into a Rethink vault on a Safe. You hold the share token.",
  },
  {
    title: "Yield funds Rethink",
    text: "The yield goes to the treasury. Your principal stays put and exits any settlement cycle.",
  },
  {
    title: "Earn REFI",
    text: "REFI accrues every block, weighted by the tier you entered.",
  },
];

const stakeCard = ref<{ prefill: (symbol: StakeSymbol, amount: number) => void; $el: HTMLElement }>();
const calculator = ref<{ open: () => void; $el: HTMLElement }>();

const scrollTo = (el?: HTMLElement) => el?.scrollIntoView?.({ behavior: "smooth", block: "center" });

const goToStake = () => scrollTo(stakeCard.value?.$el);

const openCalculator = () => {
  calculator.value?.open();
  nextTick(() => calculator.value?.$el?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
};

const onCalculatorStake = (symbol: StakeSymbol, amount: number) => {
  if (!stakeCard.value) return;
  scrollTo(stakeCard.value.$el);
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
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    align-items: center;
    gap: 3rem;
    padding: 3.5rem 0 1.5rem;
    isolation: isolate;

    // A brand glow and a faint grid behind the hero, fading out at the edges.
    &::before {
      content: "";
      position: absolute;
      inset: -4rem -50vw 0;
      z-index: -1;
      background:
        radial-gradient(40rem 22rem at 70% 45%, $color-accent-soft, transparent 70%),
        linear-gradient($color-line 1px, transparent 1px) 0 0 / 48px 48px,
        linear-gradient(90deg, $color-line 1px, transparent 1px) 0 0 / 48px 48px;
      mask-image: radial-gradient(60rem 30rem at 50% 40%, #000 30%, transparent 75%);
      pointer-events: none;
    }

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
      gap: 2rem;
      padding-top: 2rem;
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

  &__assets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  &__asset {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem 0.375rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-title;
  }

  &__ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  &__btn {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;

    &--ghost {
      border-color: $color-line-2;
      color: $color-title;
    }

    @media (max-width: $screen-sm) {
      flex: 1 1 100%;
    }
  }

  &__action {
    display: grid;
    grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
    align-items: start;
    gap: 2rem;
    margin-top: 1rem;

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  &__how {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
    margin: 0;
    padding: 0;
    list-style: none;

    @media (max-width: $screen-md) {
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
    }
  }

  &__step {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__step-index {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-cyan;
  }

  &__step-title {
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
  }

  &__step-text {
    font-size: $text-xs;
    line-height: 1.5;
    color: $color-subtitle;
  }

  &__explain {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: stretch;
    gap: 2rem;

    @media (max-width: $screen-lg) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
