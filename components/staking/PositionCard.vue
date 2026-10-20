<template>
  <section class="position brand_card" aria-labelledby="position-title">
    <div class="position__head">
      <span id="position-title" class="brand_card__eyebrow">Your position</span>
      <span v-if="position" class="position__tier">
        {{ position.tier.name }} · {{ position.tier.baseMultiplier }}x
      </span>
    </div>

    <template v-if="position">
      <div class="position__earned">
        <span class="position__refi">
          {{ refiEarned === null ? DASH : formatRefi(refiEarned) }}
          <small>points</small>
        </span>
        <span class="position__caption">
          Earned so far · +{{ formatInt(position.refiPerSecond * 86_400) }} a day at {{ position.tier.baseMultiplier }}x
        </span>
      </div>

      <dl class="position__rows">
        <div class="position__row">
          <dt class="position__principal">
            <Icon icon="mdi:shield-check-outline" width="0.95rem" />Principal, preserved
          </dt>
          <dd>
            {{ formatAmount(position.amount) }} {{ position.symbol }}
            <span class="position__muted">· {{ formatUsd(position.amountUsd) }}</span>
          </dd>
        </div>
        <div class="position__row">
          <dt>Yield reinvested</dt>
          <dd>
            {{ formatAmount(position.yieldRedirected) }} {{ position.symbol }}
            <span class="position__muted">· {{ formatUsd(position.yieldRedirectedUsd) }}</span>
          </dd>
        </div>
        <div class="position__row">
          <dt>Share of emissions</dt>
          <dd>{{ formatShare(position.share) }}</dd>
        </div>
      </dl>
    </template>

    <p v-else class="position__empty">
      <template v-if="isConnected">
        No stake yet. Once you deposit, your points add up here.
      </template>
      <template v-else>
        Connect your wallet to see your stake and the points you earn.
      </template>
    </p>
  </section>
</template>

<script setup lang="ts">
import {
  DASH,
  formatAmount,
  formatInt,
  formatUsd,
} from "~/composables/staking/formatStaking";
import { useAccrual } from "~/composables/staking/useAccrual";
import type { VenturePosition } from "~/composables/staking/useVentureStats";

const props = defineProps<{
  position: VenturePosition | null;
  isConnected: boolean;
}>();

const refiEarned = useAccrual(
  () => props.position?.refiEarned ?? null,
  () => props.position?.refiPerSecond ?? 0,
);

const formatRefi = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatShare = (share: number) =>
  `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;
</script>

<style scoped lang="scss">
.position {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__tier {
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__earned {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__refi {
    font-family: $font-mono;
    font-size: clamp(1.75rem, 3vw, 2.125rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    color: $color-title;
    font-variant-numeric: tabular-nums;

    small {
      font-size: 0.45em;
      font-weight: 400;
      letter-spacing: 0;
      color: $color-subtitle;
    }
  }

  &__caption {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__rows {
    display: flex;
    flex-direction: column;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 0;
    border-top: 1px solid $color-line;
    font-size: $text-sm;

    dt {
      color: $color-subtitle;
    }

    dd {
      font-family: $font-mono;
      color: $color-title;
      text-align: right;
    }
  }

  &__principal {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__muted {
    color: $color-subtitle;
  }

  &__empty {
    margin: 0;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-subtitle;
  }
}
</style>
