<template>
  <section class="sources brand_card" aria-labelledby="sources-title">
    <div class="sources__head">
      <span id="sources-title" class="brand_card__eyebrow">Source of yield</span>
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
      </div>
    </div>

    <ul class="sources__guarantees" aria-label="Guarantees">
      <li><Icon icon="mdi:scale-balance" width="0.8rem" />No leverage</li>
      <li><Icon icon="mdi:link-variant-off" width="0.8rem" />No bridges</li>
      <li><Icon icon="mdi:layers-off-outline" width="0.8rem" />No restaking</li>
    </ul>

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

  &__guarantees {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin: -0.25rem 0 0;
    padding: 0;
    list-style: none;

    li {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.1875rem 0.625rem 0.1875rem 0.5rem;
      border: 1px solid $color-line-2;
      border-radius: 999px;
      font-size: $text-xs;
      font-weight: 600;
      color: $color-title;
    }

    :deep(svg) {
      color: $color-cyan;
    }
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


}
</style>
