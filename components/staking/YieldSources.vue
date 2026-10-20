<template>
  <section class="sources brand_card" aria-labelledby="sources-title">
    <div class="sources__head">
      <span id="sources-title" class="brand_card__eyebrow">Where the yield comes from</span>
      <span class="sources__hint">No leverage, no bridges, no restaking</span>
    </div>

    <div class="sources__grid">
      <article v-for="row in rows" :key="row.asset.symbol" class="sources__asset">
        <header class="sources__asset-head">
          <span class="sources__symbol">
            <IconChain v-if="row.asset.symbol === 'ETH'" chain-short="eth" :size="20" />
            <IconBaseAsset v-else :symbol="row.asset.symbol" :size="20" />
            {{ row.asset.symbol }}
          </span>
          <span class="sources__rate" :title="`Assumed yearly yield for ${row.asset.symbol}`">
            ~{{ formatRate(row.asset.yieldRate) }}
          </span>
        </header>

        <div class="sources__deposited">
          <span class="sources__amount">{{ row.amountLabel }} {{ row.asset.symbol }}</span>
          <span class="sources__usd">{{ formatUsdCompact(row.usd) }} deposited</span>
        </div>

        <div class="sources__strategy">
          <span class="sources__label">{{ row.strategy.label }}</span>
          <p class="sources__summary">
            {{ row.strategy.summary }}
          </p>
        </div>

        <ul class="sources__list">
          <li v-for="source in row.strategy.sources" :key="source.name" class="sources__venue">
            <span class="sources__venue-name">{{ source.name }}</span>
            <span class="sources__venue-detail">{{ source.detail }}</span>
          </li>
        </ul>
      </article>
    </div>
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

const props = defineProps<{
  holdings: Record<VentureAsset["symbol"], number>;
}>();

const rows = computed(() =>
  VENTURE_STAKING_ASSETS.map((asset) => {
    const amount = props.holdings[asset.symbol] ?? 0;
    return {
      asset,
      amountLabel: asset.symbol === "USDC" ? formatCompact(amount) : formatAmount(amount, 2),
      usd: amount * asset.priceUsd,
      strategy: VENTURE_STAKING_YIELD_STRATEGIES[asset.symbol],
    };
  }),
);
</script>

<style scoped lang="scss">
.sources {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }

  &__hint {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;

    @media (max-width: $screen-md) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__asset {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.125rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__asset-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__symbol {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
  }

  &__rate {
    padding: 0.125rem 0.5rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-subtitle;
    cursor: help;
  }

  &__deposited {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__amount {
    font-family: $font-mono;
    font-size: 1.375rem;
    font-weight: 600;
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
    padding-top: 0.875rem;
    border-top: 1px solid $color-line;
  }

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__summary {
    margin: 0;
    font-size: $text-xs;
    line-height: 1.5;
    color: $color-subtitle;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__venue {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: $text-sm;
  }

  &__venue-name {
    color: $color-title;
  }

  &__venue-detail {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-subtitle;
    white-space: nowrap;
  }
}
</style>
