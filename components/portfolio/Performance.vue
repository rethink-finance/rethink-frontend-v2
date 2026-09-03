<template>
  <div class="performance brand_card">
    <div class="performance__head">
      <div class="performance__headline_block">
        <UiSegmented v-model="metric" :options="METRIC_OPTIONS" />

        <div v-if="metric === 'return'" class="performance__eyebrow">
          Return over {{ rangeLabel }}
        </div>

        <div class="performance__headline">
          <v-progress-circular
            v-if="isLoading"
            size="24"
            width="2"
            indeterminate
          />
          <template v-else-if="metric === 'return'">
            <span
              class="performance__figure"
              :class="returnPercent !== undefined && returnPercent < 0
                ? 'performance__figure--neg'
                : 'performance__figure--pos'"
            >
              {{ returnFormatted }}
            </span>
            <span class="performance__note">{{ totalFormatted }} total value</span>
          </template>
          <template v-else>
            <span class="performance__figure">{{ totalFormatted }}</span>
            <span
              v-if="pnlFormatted"
              class="performance__note"
              :class="pnl !== undefined && pnl < 0
                ? 'performance__note--neg'
                : 'performance__note--pos'"
            >
              {{ pnlFormatted }}
            </span>
          </template>
        </div>

        <div v-if="metric === 'value' && summary" class="performance__summary">
          {{ summary }}
        </div>
      </div>

      <UiRangePills
        :model-value="effectiveRange"
        :ranges="rangeKeys"
        :available="drawableRanges"
        @update:model-value="selectedRange = $event"
      />
    </div>

    <svg
      v-if="chart"
      class="performance__chart"
      :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`Portfolio ${metric} over ${rangeLabel}`"
    >
      <defs>
        <linearGradient
          :id="areaGradientId"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" :stop-color="lineColor" stop-opacity="0.1" />
          <stop offset="100%" :stop-color="lineColor" stop-opacity="0" />
        </linearGradient>
        <linearGradient
          :id="lineGradientId"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop offset="0%" :stop-color="lineColor" />
          <stop offset="100%" :stop-color="lineColorEnd" />
        </linearGradient>
      </defs>

      <!-- Stroke set in CSS, not the attribute: theme tokens are CSS custom
           properties, and var() does not resolve inside SVG presentation
           attributes. -->
      <line
        v-for="(y, index) in chart.gridLines"
        :key="index"
        class="perf_gridline"
        :x1="0"
        :x2="CHART_WIDTH"
        :y1="y"
        :y2="y"
        stroke-width="1"
      />

      <path :d="chart.area" :fill="`url(#${areaGradientId})`" />
      <path
        :d="chart.line"
        fill="none"
        :stroke="`url(#${lineGradientId})`"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        :cx="chart.lastX"
        :cy="chart.lastY"
        r="3.5"
        :fill="lineColor"
      />
    </svg>

    <div v-else-if="!isLoading" class="performance__placeholder">
      Not enough history to draw a line yet.
    </div>

    <div v-if="chart" class="performance__axis">
      <span v-for="(label, index) in chart.xLabels" :key="index">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatNumberShort } from "~/composables/formatters";
import type { ValuePoint } from "~/composables/portfolioSeries";
import {
  RANGE_KEYS,
  availableRanges,
  pointsInRange,
  resolveEffectiveRange,
} from "~/composables/chartRanges";

/**
 * What the wallet is worth, and what it has done.
 *
 * The two metrics answer different questions and so are drawn differently: a
 * value line is a running total, while a return line is rebased to the window
 * on view — switching 1M to 1Y has to change the figure, or the range buttons
 * are decoration.
 */
const props = defineProps<{
  series: ValuePoint[];
  /**
   * Cumulative percent earned, already time-weighted — see
   * buildWeightedReturnSeries. Kept apart from the value series because the
   * two answer different questions and only one of them is money.
   */
  returnSeries: ValuePoint[];
  /**
   * What the wallet holds right now, in USD. Taken from the positions rather
   * than from the end of the series: a vault the backend has no price history
   * for is missing from the line but is still money, and a headline that
   * disagreed with the table below it would be wrong twice over.
   */
  total: number;
  isLoading: boolean;
  positionCount: number;
  pendingCount: number;
  voteCount: number;
  /** Paid in less taken out across every position, in USD. */
  netInvested?: number;
}>();

const METRIC_OPTIONS = [
  { key: "value", label: "Total value" },
  { key: "return", label: "Total return" },
];
const metric = ref("value");

const rangeKeys = RANGE_KEYS;
/** A portfolio opens on everything it has; a single vault opens on its month. */
const selectedRange = ref("ALL");

const CHART_WIDTH = 860;
const CHART_HEIGHT = 240;
const GRID_LINES = 4;

// Gradient ids have to be unique in the document or two charts on one page
// would share a definition.
const uid = useId();
const areaGradientId = `pf-area-${uid}`;
const lineGradientId = `pf-line-${uid}`;

const activeSeries = computed(() =>
  metric.value === "return" ? props.returnSeries : props.series,
);

const drawableRanges = computed(() => availableRanges(activeSeries.value));

const effectiveRange = computed(() =>
  resolveEffectiveRange(selectedRange.value, drawableRanges.value),
);

const rangeLabel = computed(() =>
  effectiveRange.value === "ALL" ? "all time" : effectiveRange.value,
);

const visible = computed<ValuePoint[]>(
  () =>
    pointsInRange(activeSeries.value, effectiveRange.value) ??
    activeSeries.value,
);

/**
 * Rebased to the window on view rather than to inception — switching 1M to 1Y
 * has to change the figure, or the range buttons are decoration. The series
 * already compounds from its own start, so shifting the window is a matter of
 * dividing the two cumulative figures rather than re-deriving anything.
 */
const plotted = computed<ValuePoint[]>(() => {
  if (metric.value !== "return") return visible.value;

  const opening = visible.value[0]?.value ?? 0;
  return visible.value.map((point) => ({
    timestamp: point.timestamp,
    value: ((1 + point.value / 100) / (1 + opening / 100) - 1) * 100,
  }));
});

const returnPercent = computed(() => {
  const points = plotted.value;
  return metric.value === "return" && points.length
    ? points[points.length - 1].value
    : undefined;
});

const returnFormatted = computed(() => {
  const percent = returnPercent.value;
  if (percent === undefined) return "—";
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
});

const totalFormatted = computed(() => `$${formatNumberShort(props.total)}`);

/**
 * Gain in money rather than in percent. It needs a cost to measure against, so
 * a wallet whose positions have no measurable cost gets no figure — see
 * netInvested in portfolioPositions.
 */
const pnl = computed(() =>
  props.netInvested ? props.total - props.netInvested : undefined,
);

const pnlFormatted = computed(() => {
  const value = pnl.value;
  if (value === undefined) return "";
  return `${value >= 0 ? "+" : "-"}$${formatNumberShort(Math.abs(value))}`;
});

// The line stays on the brand blue whichever way the money went: the figure
// beside it already carries the sign in its own colour, and a chart that
// repaints itself red turns the whole card into an alarm.
const lineColor = "#16c8ff";
const lineColorEnd = "#1f5fff";

const summary = computed(() => {
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

  const parts: string[] = [];
  if (props.positionCount) {
    parts.push(plural(props.positionCount, "position", "positions"));
  }
  if (props.pendingCount) parts.push(`${props.pendingCount} pending`);
  if (props.voteCount) parts.push(`${props.voteCount} to vote`);
  return parts.join(" · ");
});

/** "-90D", "-45D", … "NOW", scaled to whatever window is on view. */
const buildXLabels = (points: ValuePoint[]) => {
  const last = points[points.length - 1].timestamp;
  const first = points[0].timestamp;
  const dayMs = 24 * 60 * 60 * 1000;

  return Array.from({ length: 5 }, (_, index) => {
    if (index === 4) return "NOW";
    const at = first + ((last - first) * index) / 4;
    return `-${Math.round((last - at) / dayMs)}D`;
  });
};

const chart = computed(() => {
  const points = plotted.value;
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A perfectly flat series has no range to scale into; centre it rather than
  // dividing by zero.
  const span = max - min || Math.abs(max) || 1;
  const pad = span * 0.08;
  const low = min - pad;
  const high = max + pad;

  const x = (index: number) =>
    (index / (points.length - 1)) * CHART_WIDTH;
  const y = (value: number) =>
    CHART_HEIGHT - ((value - low) / (high - low)) * CHART_HEIGHT;

  const line = points
    .map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(" ");

  return {
    line,
    area: `${line} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`,
    lastX: x(points.length - 1),
    lastY: y(values[values.length - 1]),
    gridLines: Array.from(
      { length: GRID_LINES },
      (_, index) => ((index + 1) / (GRID_LINES + 1)) * CHART_HEIGHT,
    ),
    xLabels: buildXLabels(points),
  };
});
</script>

<style lang="scss" scoped>
.performance {
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.375rem;
  }

  &__headline_block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.625rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__headline {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__figure {
    font-family: $font-mono;
    font-size: clamp(30px, 3.4vw, 40px);
    font-weight: 500;
    letter-spacing: -0.025em;
    line-height: 0.95;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    /* Only in return mode, where the figure itself is the gain or the loss. */
    &--pos {
      color: $color-cyan;
    }

    &--neg {
      color: $color-neg;
    }
  }

  &__note {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-steel-blue;
    white-space: nowrap;

    &--pos {
      color: $color-pos;
    }

    &--neg {
      color: $color-neg;
    }
  }

  &__summary {
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  /* preserveAspectRatio is none, so the plot stretches to the card's width at
     a fixed height rather than scaling its stroke with the viewport. */
  &__chart {
    display: block;
    width: 100%;
    height: 240px;
  }

  .perf_gridline {
    stroke: $color-line;
  }

  &__axis {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: $color-steel-blue;
  }

  &__placeholder {
    padding: 2rem 0;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}
</style>
