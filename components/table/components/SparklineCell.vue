<template>
  <svg
    v-if="points"
    class="sparkline"
    :class="isPositive ? 'sparkline--pos' : 'sparkline--neg'"
    width="72"
    height="22"
    viewBox="0 0 72 22"
  >
    <polyline
      :points="points"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  fetchFundDailyNavSnapshotsAction,
  type ParsedDailyNavSnapshotDto,
} from "~/store/funds/actions/fetchFundNavUpdates.action";
import {
  readCachedSparkline,
  writeCachedSparkline,
} from "~/store/funds/fundsCache";
import { resolveStakingPerformance } from "~/store/funds/config/stakingRewards.config";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * 30-day share price trend line (design-file "30D" column).
 * Sourced from the same daily NAV snapshots endpoint that powers
 * the share price chart on the vault details page.
 */
const props = defineProps({
  chainId: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
});

/** Emits the 30D share price change in percent once data is loaded,
 * so the parent table can rank vaults by 30-day performance. */
const emit = defineEmits<{
  (e: "performance", pct: number): void;
}>();

const prices = ref<number[]>([]);

/** Publishes the 30D change so the table can sort on it. */
const emitPerformance = (values: number[]) => {
  const first = values[0];
  const last = values[values.length - 1];
  if (first) {
    emit("performance", ((last - first) / first) * 100);
  }
};

/**
 * Vaults that pay their yield out in another token hold a share price that never
 * moves, so the snapshots draw a flat line for a position that is steadily
 * earning. Draw the configured yield instead — the same source the Cum. Return
 * and APR cells in this row read, and the same line the vault page overlays.
 */
const stakingApr = resolveStakingPerformance(props.chainId, props.address)?.apr;

/** Straight yield x time over the column's 30-day window, not compounded. */
const stakingTrend = (apr: number): number[] => {
  const days = 30;
  const steps = 30;
  return Array.from(
    { length: steps },
    (_, i) => 1 + (apr * (i / (steps - 1)) * days) / 365,
  );
};

if (stakingApr) {
  prices.value = stakingTrend(stakingApr);
  emitPerformance(prices.value);
} else {
  // Draw last session's line immediately, then refresh it below.
  const cached = readCachedSparkline(props.chainId, props.address);
  if (cached?.length) {
    prices.value = cached;
    emitPerformance(cached);
  }
}

onMounted(async () => {
  // The configured yield needs no snapshots — the line is already drawn.
  if (stakingApr) return;

  try {
    const snapshots: ParsedDailyNavSnapshotDto[] =
      await fetchFundDailyNavSnapshotsAction(
        props.chainId as ChainId,
        props.address,
      );

    const withPrice = (snapshots || [])
      .filter((s) => s.sharePrice != null && !isNaN(Number(s.sharePrice)))
      .sort((a, b) => a.timestamp - b.timestamp);

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let recent = withPrice.filter((s) => s.timestamp >= cutoff);

    // Sparse data fallback: show the most recent points we have.
    if (recent.length < 2) {
      recent = withPrice.slice(-10);
    }
    if (recent.length < 2) return;

    // Downsample evenly to at most 30 points.
    const maxPoints = 30;
    if (recent.length > maxPoints) {
      const step = (recent.length - 1) / (maxPoints - 1);
      recent = Array.from(
        { length: maxPoints },
        (_, i) => recent[Math.round(i * step)],
      );
    }

    prices.value = recent.map((s) => Number(s.sharePrice));
    writeCachedSparkline(props.chainId, props.address, prices.value);
    emitPerformance(prices.value);
  } catch {
    // No sparkline on fetch failure — the column just stays empty.
  }
});

const isPositive = computed(() => {
  if (prices.value.length < 2) return true;
  return prices.value[prices.value.length - 1] >= prices.value[0];
});

/**
 * Share of the box height the line is normalised into. A measured series has
 * volatility to fill the box with, so it gets all of it. The yield line is
 * perfectly straight and would read as a steep climb at full height, which
 * overstates a few percent a year — give it a narrow band and a gentle slope.
 */
const fillRatio = stakingApr ? 0.28 : 1;

const points = computed(() => {
  const values = prices.value;
  if (values.length < 2) return null;

  const width = 72;
  const height = 22;
  const pad = 1.5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Band the line is drawn in, centred vertically.
  const band = (height - pad * 2) * fillRatio;
  const top = (height - band) / 2;

  return values
    .map((value, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      // Flat series renders as a centered line.
      const y = range ? top + (1 - (value - min) / range) * band : height / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});
</script>

<style lang="scss" scoped>
.sparkline {
  display: block;

  &--pos {
    color: $color-pos;
  }
  &--neg {
    color: $color-neg;
  }
}
</style>
