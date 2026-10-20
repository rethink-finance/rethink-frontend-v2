<template>
  <section class="rev brand_card" aria-labelledby="rev-title">
    <div class="rev__head">
      <span id="rev-title" class="brand_card__eyebrow">Revenue share</span>
      <span class="rev__badge">Simulation</span>
    </div>
    <p class="rev__headline">
      <strong>100% of the fees Rethink Finance earns</strong> go to REFI stakers.
    </p>

    <div class="rev__controls">
      <label class="rev__control">
        <span class="rev__control-top">
          <span class="rev__control-label">Rethink AUM</span>
          <span class="rev__control-value">{{ formatUsdCompact(aum) }}</span>
        </span>
        <input
          v-model.number="aumStep"
          class="rev__slider"
          type="range"
          min="0"
          max="1000"
          step="1"
          aria-label="Rethink assets under management"
          :style="{ '--fill': `${aumStep / 10}%` }"
        >
      </label>
      <label class="rev__control">
        <span class="rev__control-top">
          <span class="rev__control-label">REFI staked</span>
          <span class="rev__control-value">{{ Math.round(staked * 100) }}%</span>
        </span>
        <input
          v-model.number="stakedPct"
          class="rev__slider"
          type="range"
          :min="RS.stakedShareMin * 100"
          :max="RS.stakedShareMax * 100"
          step="1"
          aria-label="Share of REFI supply staked"
          :style="{ '--fill': `${((stakedPct - RS.stakedShareMin * 100) / ((RS.stakedShareMax - RS.stakedShareMin) * 100)) * 100}%` }"
        >
      </label>
      <div class="rev__control">
        <span id="rev-fee" class="rev__control-label">Protocol fee</span>
        <div class="rev__segments" role="group" aria-labelledby="rev-fee">
          <button
            v-for="bps in RS.feeOptionsBps"
            :key="bps"
            type="button"
            class="rev__segment"
            :class="{ 'rev__segment--active': bps === feeBps }"
            :aria-pressed="bps === feeBps"
            @click="feeBps = bps"
          >
            {{ bps }} bps
          </button>
        </div>
      </div>
      <div class="rev__control">
        <span id="rev-fdv" class="rev__control-label">FDV</span>
        <div class="rev__segments" role="group" aria-labelledby="rev-fdv">
          <button
            v-for="scenario in VENTURE_STAKING.fdvScenarios"
            :key="scenario.fdvMillions"
            type="button"
            class="rev__segment"
            :class="{ 'rev__segment--active': scenario.fdvMillions === fdv }"
            :aria-pressed="scenario.fdvMillions === fdv"
            @click="fdv = scenario.fdvMillions"
          >
            ${{ scenario.fdvMillions }}M
          </button>
        </div>
      </div>
    </div>

    <div class="rev__figures" aria-live="polite">
      <div>
        <span class="rev__value">{{ result ? formatUsdCompact(result.feesUsd) : DASH }}</span>
        <span class="rev__label">Paid to REFI stakers a year</span>
      </div>
      <div>
        <span class="rev__value rev__value--accent">{{ result ? formatPct(result.stakedApr) : DASH }}</span>
        <span class="rev__label">Real yield on staked REFI</span>
      </div>
      <div>
        <span class="rev__value">{{ result ? formatUsdCompact(result.dailyBuyUsd) : DASH }}</span>
        <span class="rev__label">Buy pressure a day</span>
      </div>
      <div>
        <span class="rev__value">{{ result ? formatPct(result.supplyBoughtShare) : DASH }}</span>
        <span class="rev__label">of supply bought a year</span>
      </div>
    </div>

    <div class="rev__chart">
      <div class="rev__y" aria-hidden="true">
        <span v-for="tick in Y_TICKS" :key="tick" :style="{ top: `${yPct(tick)}%` }">{{ Number((tick * 100).toPrecision(2)) }}%</span>
      </div>
      <div
        ref="plot"
        class="rev__plot"
        role="img"
        :aria-label="chartSummary"
        @pointermove="onPointer"
        @pointerleave="hoverX = null"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient
              id="rev-fill"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0" class="rev__stop-top" />
              <stop offset="1" class="rev__stop-bottom" />
            </linearGradient>
          </defs>
          <line
            v-for="tick in Y_TICKS"
            :key="tick"
            class="rev__grid"
            x1="0"
            x2="100"
            :y1="yPct(tick)"
            :y2="yPct(tick)"
          />
          <path class="rev__area" :d="areaPath" fill="url(#rev-fill)" />
          <path class="rev__line" :d="linePath" />
          <line
            class="rev__eth"
            x1="0"
            x2="100"
            :y1="yPct(ethYield)"
            :y2="yPct(ethYield)"
          />
          <line
            v-if="breakEvenX !== null"
            class="rev__breakeven"
            :x1="breakEvenX"
            :x2="breakEvenX"
            :y1="yPct(ethYield)"
            y2="100"
          />
        </svg>

        <span class="rev__eth-label" :style="{ top: `${yPct(ethYield)}%` }">
          ETH staking {{ formatPct(ethYield) }}
        </span>
        <span
          v-if="breakEvenX !== null && result"
          class="rev__breakeven-label"
          :class="{ 'rev__breakeven-label--left': breakEvenX > 70 }"
          :style="{ left: `${breakEvenX}%` }"
        >
          Beats ETH from {{ formatUsdCompact(result.breakEvenAumUsd) }} AUM
        </span>
        <span class="rev__dot" :style="pointStyle(aum)" />

        <template v-if="hoverX !== null">
          <span class="rev__crosshair" :style="{ left: `${hoverX}%` }" />
          <span class="rev__dot rev__dot--hover" :style="pointStyle(aumAt(hoverX))" />
          <span
            class="rev__tip"
            :class="{ 'rev__tip--left': hoverX > 60 }"
            :style="pointStyle(aumAt(hoverX))"
          >
            <strong>{{ formatUsdCompact(aumAt(hoverX)) }} AUM</strong>
            {{ formatPct(aprAt(aumAt(hoverX))) }} on staked REFI
          </span>
        </template>
      </div>
      <div class="rev__x" aria-hidden="true">
        <span v-for="tick in X_TICKS" :key="tick" :style="{ left: `${xPct(tick)}%` }">{{ formatUsdCompact(tick) }}</span>
      </div>
    </div>

    <p class="rev__fine">
      Assumes the fees buy REFI on the market and are paid to stakers, at the scenario price. AUM is the
      total Rethink vaults manage. A simulation, not a forecast.
    </p>
  </section>
</template>

<script setup lang="ts">
import { DASH, formatUsdCompact } from "~/composables/staking/formatStaking";
import { revenueShare, stakedAprAt } from "~/composables/staking/revenueShare";
import { VENTURE_REVENUE_SHARE as RS, VENTURE_STAKING } from "~/composables/staking/ventureStakingConfig";

const ethYield = VENTURE_STAKING.stakingYield;

// The AUM slider runs on a log scale so $10M and $5B both get room.
const logMin = Math.log10(RS.aumMinUsd);
const logMax = Math.log10(RS.aumMaxUsd);
const aumToStep = (aum: number) => Math.round(((Math.log10(aum) - logMin) / (logMax - logMin)) * 1000);
const stepToAum = (step: number) => {
  const raw = 10 ** (logMin + (step / 1000) * (logMax - logMin));
  // Two significant figures: $250M, not $251.19M.
  const magnitude = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude;
};

const aumStep = ref(aumToStep(RS.defaultAumUsd));
const aum = computed(() => stepToAum(aumStep.value));
const stakedPct = ref(RS.defaultStakedShare * 100);
const staked = computed(() => stakedPct.value / 100);
const feeBps = ref<number>(RS.defaultFeeBps);
const fdv = ref<number>(VENTURE_STAKING.defaultFdvMillions);

const params = computed(() => ({ feeBps: feeBps.value, stakedShare: staked.value, fdvMillions: fdv.value }));
const result = computed(() => revenueShare({ aumUsd: aum.value, ...params.value }));
const aprAt = (aumUsd: number) => stakedAprAt(aumUsd, params.value);

// Both axes are logarithmic, which makes yield against AUM a straight line.
const Y_MIN = 0.001;
const Y_MAX = 1;
const Y_TICKS = [0.001, 0.01, 0.1, 1];
const X_TICKS = [10_000_000, 100_000_000, 1_000_000_000, 5_000_000_000];

const xPct = (aumUsd: number) => ((Math.log10(aumUsd) - logMin) / (logMax - logMin)) * 100;
const aumAt = (x: number) => 10 ** (logMin + (x / 100) * (logMax - logMin));
const yPct = (apr: number) => {
  const clamped = Math.min(Math.max(apr, Y_MIN), Y_MAX);
  return (1 - (Math.log10(clamped) - Math.log10(Y_MIN)) / (Math.log10(Y_MAX) - Math.log10(Y_MIN))) * 100;
};

const samples = computed(() =>
  Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * 100;
    return [x, yPct(aprAt(aumAt(x)))] as const;
  }),
);
const linePath = computed(() =>
  samples.value.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
);
const areaPath = computed(() => `${linePath.value} L100,100 L0,100 Z`);

const breakEvenX = computed(() => {
  const value = result.value?.breakEvenAumUsd;
  if (!value || value < RS.aumMinUsd || value > RS.aumMaxUsd) return null;
  return xPct(value);
});

const pointStyle = (aumUsd: number) => ({
  left: `${xPct(aumUsd)}%`,
  top: `${yPct(aprAt(aumUsd))}%`,
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

const chartSummary = computed(() =>
  result.value
    ? `Yield on staked REFI rises with Rethink AUM. At ${formatUsdCompact(aum.value)} it is ` +
      `${formatPct(result.value.stakedApr)}; it passes ETH staking at ${formatUsdCompact(result.value.breakEvenAumUsd)}.`
    : "Yield on staked REFI against Rethink AUM.",
);
</script>

<style scoped lang="scss">
.rev {
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
    margin: -0.25rem 0 0;
    font-size: 1.125rem;
    line-height: 1.4;
    color: $color-subtitle;

    strong {
      font-weight: 600;
      color: $color-title;
    }
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

  &__eth {
    stroke: var(--text-faint);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    vector-effect: non-scaling-stroke;
  }

  &__breakeven {
    stroke: var(--cyan-raw);
    stroke-width: 1;
    stroke-dasharray: 2 3;
    vector-effect: non-scaling-stroke;
  }

  &__eth-label,
  &__breakeven-label {
    position: absolute;
    font-family: $font-mono;
    font-size: 10px;
    white-space: nowrap;
    pointer-events: none;
  }

  &__eth-label {
    right: 0;
    color: $color-subtitle;
    transform: translateY(calc(-100% - 4px));
  }

  &__breakeven-label {
    bottom: 6px;
    padding-left: 6px;
    color: $color-cyan;

    &--left {
      padding: 0 6px 0 0;
      transform: translateX(-100%);
    }
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

    &--hover {
      width: 10px;
      height: 10px;
      background: $color-primary;
      box-shadow: none;
    }
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
