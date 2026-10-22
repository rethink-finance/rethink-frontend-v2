<template>
  <div class="stake_page page_shell page_shell--tall_head">
    <div class="stake_topbar">
      <NuxtLink to="/" class="stake_topbar__back">
        <Icon icon="mdi:arrow-left" width="0.8125rem" />
        All vaults
      </NuxtLink>
    </div>

    <!-- The fund details page's layout: identity top-left, content beneath it,
         and the deposit rail filling the right column from the title down so
         it stays pinned while the left column scrolls. -->
    <div class="stake_layout">
      <header class="stake_header stake_layout__header">
        <div class="stake_header__tile">
          <StakingRefiMark :size="44" />
        </div>
        <div class="stake_header__body">
          <h1 class="stake_header__title">
            Venture Staking
            <span
              v-if="isPreview"
              class="stake_header__preview"
              title="Sample figures until the staking vault is deployed"
            >
              Preview data
            </span>
          </h1>
          <div class="stake_header__meta">
            <span class="stake_header__curator">by rethink.finance DAO</span>
            <span class="stake_header__sep" />
            <span v-for="symbol in ASSET_SYMBOLS" :key="symbol" class="stake_header__chip">
              <IconChain v-if="symbol === 'ETH'" chain-short="eth" />
              <IconBaseAsset v-else :symbol="symbol" />
              {{ symbol }}
            </span>
            <span class="stake_header__sep" />
            <span class="stake_header__chip">
              <IconChain chain-short="eth" />
              Ethereum
            </span>
          </div>
        </div>
      </header>

      <aside class="stake_layout__rail" aria-label="Deposit and your position">
        <StakingStakeCard
          ref="stakeCard"
          v-model:token="selectedAsset"
          :multiplier="currentTier.baseMultiplier"
          @calculate="isCalculatorOpen = true"
        />
        <StakingPositionCard :position="position" :is-connected="accountStore.isConnected" />
      </aside>

      <div class="stake_layout__body">
        <StakingHowItWorks :multiplier="currentTier.baseMultiplier" />

        <!-- The vault page's stat strip: the headline figure at display size,
             the derived ones a step down beside it. -->
        <div class="stake_stats">
          <div class="stake_stats__item">
            <span class="stake_stats__label stake_stats__label--accent">Total staked</span>
            <div class="stake_stats__value_row">
              <span class="stake_stats__value stake_stats__value--hero">{{ formatUsdCompact(program.stakedUsd) }}</span>
            </div>
          </div>
        </div>

        <StakingTrancheCard
          :fills="fills"
          :counted-by-asset="program.countedByAsset"
          :holdings="program.holdings"
          :selected="selectedAsset"
        />
        <StakingYieldSources v-model:selected="selectedAsset" :holdings="program.holdings" />
        <StakingBuybacks />
      </div>
    </div>

    <StakingCalculatorDialog
      v-model="isCalculatorOpen"
      :pool-usd="poolUsd"
      :pool-yield-weight="poolYieldWeight"
      :selected="selectedAsset"
      @stake="onCalculatorStake"
    />
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account/account.store";
import { formatUsdCompact } from "~/composables/staking/formatStaking";
import { useVentureStats } from "~/composables/staking/useVentureStats";
import { tierFills } from "~/composables/staking/ventureStaking";
import { VENTURE_STAKING_ASSETS, type VentureAsset } from "~/composables/staking/ventureStakingConfig";

type StakeSymbol = VentureAsset["symbol"];

const ASSET_SYMBOLS = VENTURE_STAKING_ASSETS.map((asset) => asset.symbol);

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
.stake_page {
  padding-bottom: 2rem;
}

// The vault page's "All vaults" row.
.stake_topbar {
  display: flex;
  align-items: center;
  margin-bottom: 1.75rem;

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    text-decoration: none;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }
  }
}

.stake_layout {
  @include xl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    column-gap: 1.375rem;
    align-items: start;
  }

  &__header {
    @include xl {
      grid-column: 1;
      grid-row: 1;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1.375rem;
    min-width: 0;

    @include xl {
      grid-column: 1;
      grid-row: 2;
    }
  }

  // The deposit rail spans both rows so it can stay pinned for the whole
  // scroll, always by its top so the Deposit header never slides under the
  // navbar. Below desktop it comes right after the identity.
  &__rail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
    margin-bottom: 1.375rem;

    :deep(.brand_card) {
      padding: 1.375rem 1.5rem;
    }

    @include xl {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: start;
      position: sticky;
      top: calc(#{$navbar-height} + 1rem);
      margin-bottom: 0;
    }

    // Short windows: tighten both cards so the whole rail still fits.
    @media (max-height: 820px) and (min-width: $screen-xl) {
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
}

// The vault page's identity block.
.stake_header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 2.5rem;

  &__tile {
    display: grid;
    flex: none;
    place-items: center;
    width: 78px;
    height: 78px;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-navy-gray-light;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.6875rem;
    min-width: 220px;
  }

  &__title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.875rem;
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: $color-white;
  }

  &__preview {
    padding: 0.125rem 0.5rem;
    border: 1px dashed $color-line-3;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-subtitle;
    cursor: help;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__curator {
    font-size: 15px;
    color: $color-steel-blue;
  }

  &__sep {
    flex: none;
    width: 3px;
    height: 3px;
    border-radius: 999px;
    background: $color-steel-blue;
  }

  &__chip {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-family: $font-mono;
    font-size: 13.5px;
    color: $color-text-irrelevant;
  }
}

// The vault page's stat strip.
.stake_stats {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.5rem 2.5rem;
  margin: 0.5rem 0;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 0.8125rem;
    min-width: 0;
  }

  &__label {
    font-family: $font-mono;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--accent {
      letter-spacing: 0.16em;
      color: $color-cyan;
    }
  }

  &__value_row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem 0.625rem;
  }

  &__value {
    font-family: $font-mono;
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.015em;
    line-height: 1;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    &--hero {
      font-size: clamp(36px, 4.4vw, 56px);
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 0.95;
    }

  }


}
</style>
