<template>
  <section class="sources brand_card" aria-labelledby="sources-title">
    <div class="sources__head">
      <span id="sources-title" class="brand_card__eyebrow">Where the yield comes from</span>
      <StakingAssetTabs :model-value="selected" size="small" @update:model-value="emit('update:selected', $event)" />
    </div>

    <div class="sources__facts">
      <div class="sources__deposited">
        <span class="sources__amount">{{ amountLabel }} {{ asset.symbol }}</span>
        <span class="sources__usd">{{ formatUsdCompact(amount * asset.priceUsd) }} deposited</span>
      </div>
      <div class="sources__strategy">
        <span class="sources__label">
          {{ strategy.label }}
          <span class="sources__rate" title="Assumed yearly yield">~{{ formatRate(asset.yieldRate) }} a year</span>
        </span>
        <p class="sources__summary">
          {{ strategy.summary }}
        </p>
      </div>
    </div>

    <StakingYieldFlow :asset="asset" :amount="amount" :strategy="strategy" />

  </section>
</template>

<script setup lang="ts">
import {
  formatAmount,
  formatCompact,
  formatRate,
  formatUsdCompact,
} from "~/composables/staking/formatStaking";
import {
  VENTURE_STAKING_ASSETS,
  VENTURE_STAKING_YIELD_STRATEGIES,
  type VentureAsset,
} from "~/composables/staking/ventureStakingConfig";

type AssetSymbol = VentureAsset["symbol"];

const props = defineProps<{
  selected: AssetSymbol;
  holdings: Record<AssetSymbol, number>;
}>();

const emit = defineEmits<{ "update:selected": [symbol: AssetSymbol] }>();

const asset = computed(
  () => VENTURE_STAKING_ASSETS.find((option) => option.symbol === props.selected) ?? VENTURE_STAKING_ASSETS[0],
);
const strategy = computed(() => VENTURE_STAKING_YIELD_STRATEGIES[asset.value.symbol]);
const amount = computed(() => props.holdings[asset.value.symbol] ?? 0);
const amountLabel = computed(() =>
  asset.value.symbol === "USDC" ? formatCompact(amount.value) : formatAmount(amount.value, 2),
);
</script>

<style scoped lang="scss">
.sources {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
  }

  &__facts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem 2rem;

    @media (max-width: $screen-sm) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__deposited {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-right: 2rem;
    border-right: 1px solid $color-line;

    @media (max-width: $screen-sm) {
      padding-right: 0;
      border-right: 0;
    }
  }

  &__amount {
    font-family: $font-mono;
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.1;
    color: $color-title;
    white-space: nowrap;
  }

  &__usd {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__strategy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.625rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__rate {
    padding: 0.0625rem 0.4375rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    letter-spacing: 0;
    text-transform: none;
    color: $color-subtitle;
    cursor: help;
  }

  &__summary {
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;
  }

}
</style>
