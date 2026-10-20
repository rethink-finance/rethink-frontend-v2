<template>
  <section class="pstats" aria-label="Program totals">
    <div class="pstats__cell pstats__cell--deposits">
      <span class="pstats__value">{{ formatUsd(program.stakedUsd) }}</span>
      <span class="pstats__label">Total deposited</span>
      <ul class="pstats__assets">
        <li v-for="row in assetRows" :key="row.symbol" class="pstats__asset">
          <span class="pstats__asset-name">
            <IconChain v-if="row.symbol === 'ETH'" chain-short="eth" :size="16" />
            <IconBaseAsset v-else :symbol="row.symbol" :size="16" />
            {{ row.symbol }}
          </span>
          <span class="pstats__asset-amount">{{ row.amountLabel }}</span>
          <span class="pstats__asset-usd">{{ formatUsd(row.usd) }}</span>
          <span class="pstats__asset-bar" aria-hidden="true">
            <span :style="{ width: `${row.share * 100}%`, background: `var(--asset-${row.symbol.toLowerCase()})` }" />
          </span>
        </li>
      </ul>
    </div>
    <div class="pstats__cell">
      <span class="pstats__value">
        <template v-if="program.yieldGeneratedUsd !== null">
          {{ formatUsd(program.yieldGeneratedUsd) }}
        </template>
        <template v-else>
          {{ DASH }}
        </template>
      </span>
      <span class="pstats__label">Yield generated</span>
      <span class="pstats__detail">
        Across all assets, reinvested in the ecosystem
      </span>
    </div>
    <div class="pstats__cell">
      <span class="pstats__value">
        <template v-if="pointsDistributed !== null">
          {{ formatInt(pointsDistributed) }}
        </template>
        <template v-else>
          {{ DASH }}
        </template>
      </span>
      <span class="pstats__label">Points distributed</span>
      <span class="pstats__detail">of {{ formatCompact(stakerAllocation, 0) }} for stakers</span>
    </div>
    <div class="pstats__cell">
      <span class="pstats__value">{{ program.stakers ?? DASH }}</span>
      <span class="pstats__label">Stakers</span>
      <span class="pstats__detail">
        <template v-if="program.daysLive !== null">{{ program.daysLive }} days live</template>
        <template v-else>Since launch</template>
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  DASH,
  formatAmount,
  formatCompact,
  formatInt,
  formatUsd,
} from "~/composables/staking/formatStaking";
import { useAccrual } from "~/composables/staking/useAccrual";
import type { VentureProgramStats } from "~/composables/staking/useVentureStats";
import { VENTURE_STAKING, VENTURE_STAKING_ASSETS } from "~/composables/staking/ventureStakingConfig";

const props = defineProps<{ program: VentureProgramStats }>();

const stakerAllocation = VENTURE_STAKING.supply * VENTURE_STAKING.stakerAllocationShare;

const pointsDistributed = useAccrual(
  () => props.program.refiDistributed,
  () => props.program.refiPerSecond,
);

const assetRows = computed(() =>
  VENTURE_STAKING_ASSETS.map((asset) => {
    const amount = props.program.holdings[asset.symbol] ?? 0;
    const usd = amount * asset.priceUsd;
    return {
      symbol: asset.symbol,
      amountLabel: asset.symbol === "USDC" ? formatCompact(amount) : formatAmount(amount, 2),
      usd,
      share: props.program.stakedUsd > 0 ? usd / props.program.stakedUsd : 0,
    };
  }),
);
</script>

<style scoped lang="scss">
.pstats {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) repeat(3, minmax(0, 1fr));
  border-top: 1px solid $color-line;
  border-bottom: 1px solid $color-line;

  @media (max-width: $screen-lg) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: $screen-sm) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1.5rem 1.5rem 1.5rem 0;

    & + & {
      padding-left: 1.5rem;
      border-left: 1px solid $color-line;
    }

    &--deposits {
      padding-right: 2rem;

      @media (max-width: $screen-lg) {
        grid-column: 1 / -1;
        padding-right: 0;
        border-bottom: 1px solid $color-line;
      }
    }

    @media (max-width: $screen-lg) {
      &:nth-child(2) {
        padding-left: 0;
        border-left: 0;
      }
    }

    @media (max-width: $screen-sm) {
      padding: 1.125rem 0.75rem 1.125rem 0;

      & + & {
        padding-left: 0.75rem;
      }

      &:nth-child(4) {
        grid-column: 1 / -1;
        padding-left: 0;
        border-left: 0;
        border-top: 1px solid $color-line;
      }
    }
  }

  &__value {
    font-family: $font-mono;
    font-size: clamp(1.375rem, 3vw, 2rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: $color-title;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;

    small {
      font-size: 0.5em;
      font-weight: 400;
      letter-spacing: 0;
      color: $color-subtitle;
    }
  }

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-subtitle;
  }

  &__detail {
    font-size: $text-xs;
    line-height: 1.4;
    color: $color-subtitle;
  }

  &__assets {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0.625rem 0 0;
    padding: 0;
    list-style: none;
  }

  &__asset {
    display: grid;
    grid-template-columns: 5.5rem 5rem 4.5rem minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    font-family: $font-mono;
    font-size: $text-xs;

    @media (max-width: $screen-sm) {
      grid-template-columns: 4.75rem 4rem minmax(0, 1fr);
    }
  }

  &__asset-name {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: $color-title;
  }

  &__asset-amount {
    color: $color-title;
    text-align: right;
  }

  &__asset-usd {
    color: $color-subtitle;
    text-align: right;
  }

  &__asset-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--fill-2);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      border-radius: 2px;
    }

    @media (max-width: $screen-sm) {
      display: none;
    }
  }
}
</style>
