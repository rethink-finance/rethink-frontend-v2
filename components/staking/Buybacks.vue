<template>
  <section class="bb brand_card" aria-labelledby="bb-title">
    <div class="bb__head">
      <span id="bb-title" class="brand_card__eyebrow">Buybacks</span>
      <span class="bb__badge">Simulation</span>
    </div>
    <p class="bb__headline">
      <span class="bb__big">100%</span>
      <span>of the revenue Rethink Finance earns <strong>buys back REFI</strong> on the open market.</span>
    </p>

    <div class="bb__controls">
      <label class="bb__control bb__control--wide">
        <span class="bb__control-top">
          <span class="bb__control-label">Rethink AUM</span>
          <span class="bb__control-value">{{ formatUsdCompact(aum) }}</span>
        </span>
        <input
          v-model.number="aumStep"
          class="bb__slider"
          type="range"
          min="0"
          max="1000"
          step="1"
          aria-label="Rethink assets under management"
          :style="{ '--fill': `${aumStep / 10}%` }"
        >
      </label>
      <div class="bb__control">
        <span id="bb-fee" class="bb__control-label">Protocol fee</span>
        <div class="bb__segments" role="group" aria-labelledby="bb-fee">
          <button
            v-for="bps in BB.feeOptionsBps"
            :key="bps"
            type="button"
            class="bb__segment"
            :class="{ 'bb__segment--active': bps === feeBps }"
            :aria-pressed="bps === feeBps"
            @click="feeBps = bps"
          >
            {{ bps }} bps
          </button>
        </div>
      </div>
      <div class="bb__control">
        <span id="bb-fdv" class="bb__control-label">FDV</span>
        <div class="bb__segments" role="group" aria-labelledby="bb-fdv">
          <button
            v-for="scenario in VENTURE_STAKING.fdvScenarios"
            :key="scenario.fdvMillions"
            type="button"
            class="bb__segment"
            :class="{ 'bb__segment--active': scenario.fdvMillions === fdv }"
            :aria-pressed="scenario.fdvMillions === fdv"
            @click="fdv = scenario.fdvMillions"
          >
            ${{ scenario.fdvMillions }}M
          </button>
        </div>
      </div>
    </div>

    <div class="bb__figures" aria-live="polite">
      <div>
        <span class="bb__value bb__value--accent">{{ result ? formatUsdCompact(result.yearlyUsd) : DASH }}</span>
        <span class="bb__label">of REFI bought back a year</span>
      </div>
      <div>
        <span class="bb__value">{{ result ? formatUsdCompact(result.dailyUsd) : DASH }}</span>
        <span class="bb__label">Buy pressure, every day</span>
      </div>
      <div>
        <span class="bb__value">{{ result ? formatPct(result.supplyShare) : DASH }}</span>
        <span class="bb__label">
          of supply a year<template v-if="result">, {{ formatCompact(result.tokensPerYear) }} REFI</template>
        </span>
      </div>
      <div>
        <span class="bb__value">{{ formatUsdCompact(roundSig(crossings[0].aum)) }}</span>
        <span class="bb__label">AUM to outpace year-{{ crossings[0].year }} emissions</span>
      </div>
    </div>

    <div class="bb__chart">
      <div class="bb__y" aria-hidden="true">
        <span v-for="tick in Y_TICKS" :key="tick" :style="{ top: `${yPct(tick)}%` }">{{ tickLabel(tick) }}</span>
      </div>
      <div
        ref="plot"
        class="bb__plot"
        role="img"
        :aria-label="chartSummary"
        @pointermove="onPointer"
        @pointerleave="hoverX = null"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient
              id="bb-fill"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0" class="bb__stop-top" />
              <stop offset="1" class="bb__stop-bottom" />
            </linearGradient>
          </defs>
          <line
            v-for="tick in Y_TICKS"
            :key="tick"
            class="bb__grid"
            x1="0"
            x2="100"
            :y1="yPct(tick)"
            :y2="yPct(tick)"
          />
          <path class="bb__area" :d="areaPath" fill="url(#bb-fill)" />
          <path class="bb__line" :d="linePath" />
          <line
            v-for="crossing in crossings"
            :key="crossing.year"
            class="bb__emission"
            x1="0"
            x2="100"
            :y1="yPct(crossing.share)"
            :y2="yPct(crossing.share)"
          />
        </svg>

        <span
          v-for="crossing in crossings"
          :key="`l${crossing.year}`"
          class="bb__emission-label"
          :style="{ top: `${yPct(crossing.share)}%` }"
        >
          Year-{{ crossing.year }} emissions {{ formatPct(crossing.share) }}
        </span>
        <span
          v-for="crossing in visibleCrossings"
          :key="`c${crossing.year}`"
          class="bb__cross"
          :style="{ left: `${xPct(crossing.aum)}%`, top: `${yPct(crossing.share)}%` }"
        >
          <span class="bb__cross-label">{{ formatUsdCompact(roundSig(crossing.aum)) }}</span>
        </span>
        <span class="bb__dot" :style="pointStyle(aum)" />

        <template v-if="hoverX !== null">
          <span class="bb__crosshair" :style="{ left: `${hoverX}%` }" />
          <span
            class="bb__tip"
            :class="{ 'bb__tip--left': hoverX > 60 }"
            :style="pointStyle(aumAt(hoverX))"
          >
            <strong>{{ formatUsdCompact(aumAt(hoverX)) }} AUM</strong>
            buys back {{ formatPct(shareAt(aumAt(hoverX))) }} of supply a year
          </span>
        </template>
      </div>
      <div class="bb__x" aria-hidden="true">
        <span v-for="tick in X_TICKS" :key="tick" :style="{ left: `${xPct(tick)}%` }">{{ formatUsdCompact(tick) }}</span>
      </div>
    </div>

    <p class="bb__fine">
      Where the blue line crosses an emissions line, buybacks take more REFI off the market than the program
      adds that year. Priced at the FDV scenario. A simulation, not a forecast.
    </p>
  </section>
</template>

<script setup lang="ts">
import { DASH, formatCompact, formatUsdCompact } from "~/composables/staking/formatStaking";
import {
  aumToBuyBack,
  buybackShareAt,
  buybacks,
  emissionShareInYear,
} from "~/composables/staking/revenueShare";
import { VENTURE_BUYBACKS as BB, VENTURE_STAKING } from "~/composables/staking/ventureStakingConfig";

// The AUM slider runs on a log scale so $10M and $5B both get room.
const logMin = Math.log10(BB.aumMinUsd);
const logMax = Math.log10(BB.aumMaxUsd);
const aumToStep = (aum: number) => Math.round(((Math.log10(aum) - logMin) / (logMax - logMin)) * 1000);
const stepToAum = (step: number) => {
  const raw = 10 ** (logMin + (step / 1000) * (logMax - logMin));
  // Two significant figures: $250M, not $251.19M.
  const magnitude = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude;
};

const aumStep = ref(aumToStep(BB.defaultAumUsd));
const aum = computed(() => stepToAum(aumStep.value));
const feeBps = ref<number>(BB.defaultFeeBps);
const fdv = ref<number>(VENTURE_STAKING.defaultFdvMillions);

const params = computed(() => ({ feeBps: feeBps.value, fdvMillions: fdv.value }));
const result = computed(() => buybacks({ aumUsd: aum.value, ...params.value }));
const shareAt = (aumUsd: number) => buybackShareAt(aumUsd, params.value);

const crossings = computed(() =>
  BB.emissionYears.map((year) => {
    const share = emissionShareInYear(year);
    return { year, share, aum: aumToBuyBack(share, params.value) };
  }),
);
const visibleCrossings = computed(() =>
  crossings.value.filter((crossing) => crossing.aum >= BB.aumMinUsd && crossing.aum <= BB.aumMaxUsd),
);

// Both axes are logarithmic, which makes buybacks against AUM a straight line.
const Y_MIN = 0.0001;
const Y_MAX = 1;
const Y_TICKS = [0.0001, 0.001, 0.01, 0.1, 1];
const X_TICKS = [10_000_000, 100_000_000, 1_000_000_000, 5_000_000_000];

const xPct = (aumUsd: number) => ((Math.log10(aumUsd) - logMin) / (logMax - logMin)) * 100;
const aumAt = (x: number) => 10 ** (logMin + (x / 100) * (logMax - logMin));
const yPct = (share: number) => {
  const clamped = Math.min(Math.max(share, Y_MIN), Y_MAX);
  return (1 - (Math.log10(clamped) - Math.log10(Y_MIN)) / (Math.log10(Y_MAX) - Math.log10(Y_MIN))) * 100;
};

const linePath = computed(() =>
  [0, 100].map((x, i) => `${i ? "L" : "M"}${x},${yPct(shareAt(aumAt(x))).toFixed(2)}`).join(" "),
);
const areaPath = computed(() => `${linePath.value} L100,100 L0,100 Z`);

const pointStyle = (aumUsd: number) => ({
  left: `${xPct(aumUsd)}%`,
  top: `${yPct(shareAt(aumUsd))}%`,
});

const plot = ref<HTMLElement>();
const hoverX = ref<number | null>(null);
const onPointer = (event: PointerEvent) => {
  const rect = plot.value?.getBoundingClientRect();
  if (!rect?.width) return;
  hoverX.value = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
};

const formatPct = (value: number) => {
  const pct = value * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
};
/** Two significant figures: $850M, $2B. */
const roundSig = (value: number) => {
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
};

const tickLabel = (tick: number) => `${Number((tick * 100).toPrecision(2))}%`;

const chartSummary = computed(() =>
  `Share of REFI supply bought back a year against Rethink AUM. At ${formatUsdCompact(aum.value)} it is ` +
  `${result.value ? formatPct(result.value.supplyShare) : "unknown"}; buybacks outpace year-1 emissions from ` +
  `${formatUsdCompact(crossings.value[0].aum)}.`,
);
</script>

<style scoped lang="scss">
.bb {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__badge {
    padding: 0.125rem 0.5rem;
    border: 1px dashed $color-line-3;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-subtitle;
  }

  &__headline {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.4;
    color: $color-subtitle;

    strong {
      font-weight: 600;
      color: $color-title;
    }

    @media (max-width: $screen-sm) {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }

  &__big {
    flex-shrink: 0;
    font-family: $font-mono;
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.04em;
    background: $gradient-brand;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem 2rem;

    @media (max-width: $screen-sm) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__control {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;

    &--wide {
      grid-column: 1 / -1;
    }
  }

  &__control-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  &__control-label {
    font-size: $text-sm;
    color: $color-subtitle;
  }

  &__control-value {
    font-family: $font-mono;
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
  }

  &__slider {
    width: 100%;
    height: 6px;
    min-height: 0;
    padding: 0;
    margin: 0.375rem 0;
    border-radius: 3px;
    background: linear-gradient(to right, $color-primary var(--fill), var(--fill-2) var(--fill));
    appearance: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border: 3px solid $color-primary;
      border-radius: 50%;
      background: var(--text);
    }

    &::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border: 3px solid $color-primary;
      border-radius: 50%;
      background: var(--text);
    }

    &:focus-visible {
      outline: 1px solid var(--accent-line);
      outline-offset: 6px;
    }
  }

  &__segments {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    padding: 0.1875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__segment {
    padding: 0.375rem 0.5rem;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
    transition: background $default-transition-time, color $default-transition-time;

    &:hover {
      color: $color-title;
    }

    &:focus-visible {
      outline: 1px solid var(--accent-line);
    }

    &--active {
      background: var(--fill-2);
      color: $color-title;
    }
  }

  &__figures {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    padding: 1.125rem 0;
    border-top: 1px solid $color-line;
    border-bottom: 1px solid $color-line;

    @media (max-width: $screen-md) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    div {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }
  }

  &__value {
    font-family: $font-mono;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
    color: $color-title;

    &--accent {
      color: $color-cyan;
    }
  }

  &__label {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__chart {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr);
    grid-template-rows: 12rem auto;
    column-gap: 0.5rem;
  }

  &__y {
    position: relative;

    span {
      position: absolute;
      right: 0;
      font-family: $font-mono;
      font-size: 10px;
      color: $color-subtitle;
      transform: translateY(-50%);
    }
  }

  &__plot {
    position: relative;
    cursor: crosshair;
    touch-action: pan-y;

    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  }

  &__x {
    position: relative;
    grid-column: 2;
    height: 1.25rem;
    margin-top: 0.375rem;

    span {
      position: absolute;
      font-family: $font-mono;
      font-size: 10px;
      color: $color-subtitle;
      transform: translateX(-50%);
      white-space: nowrap;

      &:first-child {
        transform: none;
      }

      &:last-child {
        transform: translateX(-100%);
      }
    }
  }

  &__stop-top {
    stop-color: var(--primary);
    stop-opacity: 0.25;
  }

  &__stop-bottom {
    stop-color: var(--primary);
    stop-opacity: 0;
  }

  &__grid {
    stroke: var(--line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  &__line {
    fill: none;
    stroke: var(--primary);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  &__emission {
    stroke: var(--text-faint);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    vector-effect: non-scaling-stroke;
  }

  &__emission-label {
    position: absolute;
    left: 0.25rem;
    font-family: $font-mono;
    font-size: 10px;
    color: $color-subtitle;
    white-space: nowrap;
    transform: translateY(calc(-100% - 3px));
    pointer-events: none;
  }

  &__cross {
    position: absolute;
    z-index: 1;
    width: 11px;
    height: 11px;
    border: 2px solid $color-cyan-raw;
    border-radius: 50%;
    background: $color-surface;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  &__cross-label {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    padding: 0 0.25rem;
    border-radius: 2px;
    background: $color-surface;
    font-family: $font-mono;
    font-size: 10px;
    color: $color-cyan;
    white-space: nowrap;
    transform: translateX(-50%);
  }

  &__dot {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid $color-surface;
    border-radius: 50%;
    background: $color-cyan-raw;
    box-shadow: 0 0 0 4px $color-cyan-tint;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  &__crosshair {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: $color-line-3;
    pointer-events: none;
  }

  &__tip {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: var(--surface-float);
    box-shadow: var(--shadow-float);
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
    white-space: nowrap;
    transform: translate(12px, -110%);
    pointer-events: none;
    z-index: 2;

    strong {
      font-weight: 600;
      color: $color-title;
    }

    &--left {
      transform: translate(calc(-100% - 12px), -110%);
    }
  }

  &__fine {
    margin: 0;
    font-size: $text-xs;
    line-height: 1.5;
    color: $color-subtitle;
  }
}
</style>
