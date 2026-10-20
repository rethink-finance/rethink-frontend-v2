<template>
  <section class="pstats" aria-label="Program totals">
    <div class="pstats__cell">
      <span class="pstats__value">
        {{ program.yieldGeneratedUsd !== null ? formatUsd(program.yieldGeneratedUsd) : DASH }}
      </span>
      <span class="pstats__label">Yield generated</span>
      <span class="pstats__detail">Across all assets, reinvested in the ecosystem</span>
    </div>
    <div class="pstats__cell">
      <span class="pstats__value">
        {{ pointsDistributed !== null ? formatInt(pointsDistributed) : DASH }}
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
  formatCompact,
  formatInt,
  formatUsd,
} from "~/composables/staking/formatStaking";
import { useAccrual } from "~/composables/staking/useAccrual";
import type { VentureProgramStats } from "~/composables/staking/useVentureStats";
import { VENTURE_STAKING } from "~/composables/staking/ventureStakingConfig";

const props = defineProps<{ program: VentureProgramStats }>();

const stakerAllocation = VENTURE_STAKING.supply * VENTURE_STAKING.stakerAllocationShare;

const pointsDistributed = useAccrual(
  () => props.program.refiDistributed,
  () => props.program.refiPerSecond,
);
</script>

<style scoped lang="scss">
.pstats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid $color-line;
  border-bottom: 1px solid $color-line;

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1.375rem 1.5rem 1.375rem 0;

    & + & {
      padding-left: 1.5rem;
      border-left: 1px solid $color-line;
    }

    @media (max-width: $screen-sm) {
      padding: 1rem 0.5rem 1rem 0;

      & + & {
        padding-left: 0.75rem;
      }
    }
  }

  &__value {
    font-family: $font-mono;
    font-size: clamp(1.125rem, 3vw, 1.75rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: $color-title;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
