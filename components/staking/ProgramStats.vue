<template>
  <section class="pstats" aria-label="Program totals">
    <div class="pstats__cell">
      <span class="pstats__value">{{ formatInt(program.stakedEth) }} <small>ETH</small></span>
      <span class="pstats__label">Total staked</span>
      <span class="pstats__detail">
        {{ formatUsd(program.stakedUsd) }}
        <template v-if="holdingsLine">· {{ holdingsLine }}</template>
      </span>
    </div>
    <div class="pstats__cell">
      <span class="pstats__value">
        <template v-if="program.yieldGeneratedEth !== null">
          {{ formatAmount(program.yieldGeneratedEth, 2) }} <small>ETH</small>
        </template>
        <template v-else>{{ DASH }}</template>
      </span>
      <span class="pstats__label">Yield generated</span>
      <span class="pstats__detail">
        <template v-if="program.yieldGeneratedUsd !== null">
          {{ formatUsd(program.yieldGeneratedUsd) }} sent to the treasury
        </template>
        <template v-else>Sent to the treasury</template>
      </span>
    </div>
    <div class="pstats__cell">
      <span class="pstats__value pstats__value--live">
        <template v-if="refiDistributed !== null">
          {{ formatInt(refiDistributed) }} <small>REFI</small>
        </template>
        <template v-else>{{ DASH }}</template>
      </span>
      <span class="pstats__label">REFI distributed</span>
      <span class="pstats__detail">
        of {{ formatCompact(stakerAllocation, 0) }} for stakers
      </span>
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
import { VENTURE_STAKING } from "~/composables/staking/ventureStakingConfig";

const props = defineProps<{ program: VentureProgramStats }>();

const stakerAllocation = VENTURE_STAKING.supply * VENTURE_STAKING.stakerAllocationShare;

const refiDistributed = useAccrual(
  () => props.program.refiDistributed,
  () => props.program.refiPerSecond,
);

const holdingsLine = computed(() => {
  const { ETH, WBTC, USDC } = props.program.holdings;
  const parts = [
    ETH > 0 ? `${formatInt(ETH)} ETH` : "",
    WBTC > 0 ? `${formatAmount(WBTC, 2)} WBTC` : "",
    USDC > 0 ? `${formatCompact(USDC)} USDC` : "",
  ].filter(Boolean);
  return parts.length > 1 ? parts.join(" · ") : "";
});
</script>

<style scoped lang="scss">
.pstats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid $color-line;
  border-bottom: 1px solid $color-line;

  @media (max-width: $screen-lg) {
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

    @media (max-width: $screen-lg) {
      &:nth-child(3) {
        padding-left: 0;
        border-left: 0;
      }

      &:nth-child(n + 3) {
        border-top: 1px solid $color-line;
      }
    }

    @media (max-width: $screen-sm) {
      padding: 1.125rem 0.75rem 1.125rem 0;

      & + & {
        padding-left: 0.75rem;
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
}
</style>
