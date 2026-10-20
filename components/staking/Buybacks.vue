<template>
  <section class="bb brand_card" aria-labelledby="bb-title">
    <span id="bb-title" class="brand_card__eyebrow">Buybacks</span>
    <p class="bb__headline">
      <span class="bb__big">100%</span>
      <span>of the protocol revenue <strong>buys back <StakingRefiMark :size="18" /> REFI</strong> on the open market.</span>
    </p>

    <div class="bb__fees" aria-label="Revenue sources">
      <div
        v-for="cell in feeCells"
        :key="cell.key"
        :class="cell.op ? 'bb__op' : ['bb__fee', { 'bb__fee--total': cell.total }]"
        :aria-hidden="cell.op ? 'true' : undefined"
      >
        <template v-if="cell.op">
          {{ cell.op }}
        </template>
        <template v-else>
          <span class="bb__fee-usd">{{ formatUsdCompact(cell.usd ?? 0) }}</span>
          <span class="bb__fee-label">{{ cell.label }}</span>
          <span class="bb__fee-basis">{{ cell.basis }}</span>
        </template>
      </div>
    </div>

    <div class="bb__controls">
      <label class="bb__control">
        <span class="bb__control-top">
          <span class="bb__control-label">Rethink AUM Y1</span>
          <span class="bb__control-value">{{ formatUsdCompact(aum) }}</span>
        </span>
        <input
          v-model.number="aumStep"
          class="bb__slider"
          type="range"
          min="0"
          max="1000"
          step="1"
          aria-label="Rethink assets under management in year 1"
          :style="{ '--fill': `${aumStep / 10}%` }"
        >
      </label>
      <label class="bb__control">
        <span class="bb__control-top">
          <span class="bb__control-label">AUM growth a year</span>
          <span class="bb__control-value">{{ Math.round(growthPct) }}%</span>
        </span>
        <input
          v-model.number="growthPct"
          class="bb__slider"
          type="range"
          min="0"
          :max="BB.growthMax * 100"
          step="5"
          aria-label="Yearly growth in Rethink AUM"
          :style="{ '--fill': `${(growthPct / (BB.growthMax * 100)) * 100}%` }"
        >
      </label>
      <div class="bb__control">
        <span id="bb-fdv" class="bb__control-label">Fully Diluted Valuation at Token Launch</span>
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


    <div v-if="projection" class="bb__chart">
      <div class="bb__legend" aria-hidden="true">
        <span><span class="bb__key bb__key--buy" />REFI bought back</span>
        <span><span class="bb__key bb__key--emit" />New REFI emitted</span>
      </div>
      <div class="bb__plot" role="img" :aria-label="chartSummary">
        <div class="bb__y" aria-hidden="true">
          <span v-for="tick in yTicks" :key="tick" :style="{ bottom: `${(tick / yMax) * 100}%` }">{{ formatPct(tick) }}</span>
        </div>
        <div class="bb__area">
          <span
            v-for="tick in yTicks"
            :key="`g${tick}`"
            class="bb__gridline"
            :style="{ bottom: `${(tick / yMax) * 100}%` }"
          />
          <svg
            class="bb__emissions"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline :points="emissionPoints" />
          </svg>
          <div class="bb__bars">
            <div
              v-for="row in projection.years"
              :key="row.year"
              class="bb__col"
              :class="{ 'bb__col--deflationary': row.buybackShare >= row.emissionShare }"
              tabindex="0"
              @mouseenter="hoverYear = row.year"
              @mouseleave="hoverYear = null"
              @focus="hoverYear = row.year"
              @blur="hoverYear = null"
            >
              <span class="bb__bar" :style="{ height: `${(Math.min(row.buybackShare, yMax) / yMax) * 100}%` }" />
              <span
                class="bb__emit-dot"
                :style="{ bottom: `${(row.emissionShare / yMax) * 100}%` }"
              />
              <span v-if="hoverYear === row.year" class="bb__tip" :class="{ 'bb__tip--left': row.year > 4 }">
                <strong>Year {{ row.year }} · {{ formatUsdCompact(row.aumUsd) }} AUM</strong>
                {{ formatUsdCompact(row.revenueUsd) }} buys {{ formatPct(row.buybackShare) }} of supply
                <span>{{ formatPct(row.emissionShare) }} emitted</span>
              </span>
            </div>
          </div>
        </div>
        <div class="bb__x" aria-hidden="true">
          <span v-for="row in projection.years" :key="row.year">Year {{ row.year }}</span>
        </div>
      </div>
    </div>

    <p class="bb__fine">
      Assumes a flat {{ flatPrice }} price; real buybacks lift the price instead. Fees are estimates.
    </p>
  </section>
</template>

<script setup lang="ts">
import { formatUsdCompact } from "~/composables/staking/formatStaking";
import { buybackProjection, revenueBreakdown } from "~/composables/staking/revenueShare";
import { VENTURE_BUYBACKS as BB, VENTURE_STAKING } from "~/composables/staking/ventureStakingConfig";

// The AUM slider runs on a log scale so $10M and $2B both get room.
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
const growthPct = ref(BB.defaultGrowth * 100);
const fdv = ref<number>(VENTURE_STAKING.defaultFdvMillions);

const revenue = computed(() => revenueBreakdown(aum.value));
const sources = computed(() => {
  const model = BB.revenue;
  return [
    { label: "Platform fee", basis: `${model.platformFeeBps} bps of AUM`, usd: revenue.value.platformUsd },
    {
      label: "Manager share",
      basis: `${model.managerShare * 100}% of manager fees (assumed ${model.managerEarningsBps / 100}% of AUM)`,
      usd: revenue.value.managersUsd,
    },
    { label: "Referral fees", basis: `~${model.referralBps} bps of AUM (assumed)`, usd: revenue.value.referralsUsd },
  ];
});

/** The fees as a sum: source + source + source = total. */
const feeCells = computed(() => {
  const cells: { key: string; op?: string; label?: string; basis?: string; usd?: number; total?: boolean }[] = [];
  sources.value.forEach((source, index) => {
    if (index) cells.push({ key: `op${index}`, op: "+" });
    cells.push({ key: source.label, ...source });
  });
  cells.push({ key: "eq", op: "=" });
  cells.push({
    key: "total",
    label: "Buybacks a year",
    basis: `${revenue.value.totalBps.toFixed(1)} bps of ${formatUsdCompact(aum.value)} AUM`,
    usd: revenue.value.totalUsd,
    total: true,
  });
  return cells;
});

const projection = computed(() =>
  buybackProjection({ startAumUsd: aum.value, growth: growthPct.value / 100, fdvMillions: fdv.value }),
);

/** A round top for the y axis that fits the tallest bar or emission. */
const yMax = computed(() => {
  const rows = projection.value?.years ?? [];
  const peak = Math.max(0.01, ...rows.map((row) => Math.max(row.buybackShare, row.emissionShare)));
  const steps = [0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 1];
  return steps.find((step) => step >= peak * 1.05) ?? 1;
});
const yTicks = computed(() => [0, yMax.value / 2, yMax.value]);

const emissionPoints = computed(() => {
  const rows = projection.value?.years ?? [];
  return rows
    .map((row, i) => `${((i + 0.5) / rows.length) * 100},${100 - (row.emissionShare / yMax.value) * 100}`)
    .join(" ");
});

const hoverYear = ref<number | null>(null);

/** The launch price the projection buys at, from the chosen valuation. */
const flatPrice = computed(() => `$${((fdv.value * 1e6) / VENTURE_STAKING.supply).toFixed(2)}`);

const formatPct = (value: number) => {
  const pct = value * 100;
  if (pct === 0) return "0%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
};

const chartSummary = computed(() => {
  const p = projection.value;
  if (!p) return "REFI bought back against REFI emitted, by year.";
  return (
    `REFI bought back against REFI emitted over ${p.years.length} years. ` +
    (p.netDeflationaryYear ? `Buybacks overtake emissions in year ${p.netDeflationaryYear}.` : "")
  );
});
</script>

<style scoped lang="scss">
.bb {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;



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
    // The gradient is painted only inside the box, and the tight tracking
    // leaves the last glyph overhanging it; the padding gives it room.
    padding-right: 0.08em;
    background: $gradient-brand;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__fees {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: stretch;
    gap: 0.5rem;

    @media (max-width: $screen-md) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__fee {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;

    &--total {
      border-color: $color-cyan-line;
      background:
        linear-gradient($color-cyan-tint, $color-cyan-tint),
        $color-surface;
    }
  }

  &__fee-usd {
    font-family: $font-mono;
    font-size: 1.125rem;
    font-weight: 600;
    color: $color-title;
  }

  &__fee--total &__fee-usd {
    color: $color-cyan;
  }

  &__fee-label {
    font-size: $text-sm;
    font-weight: 600;
    color: $color-title;
  }

  &__fee-basis {
    font-size: 11px;
    line-height: 1.4;
    color: $color-subtitle;
  }

  &__op {
    align-self: center;
    font-family: $font-mono;
    font-size: 1rem;
    color: $color-subtitle;

    @media (max-width: $screen-md) {
      display: none;
    }
  }

  &__controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem 1.75rem;

    @media (max-width: $screen-md) {
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




  &__chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__legend {
    display: flex;
    gap: 1.25rem;
    font-size: $text-xs;
    color: $color-subtitle;

    > span {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
  }

  &__key {
    display: inline-block;

    &--buy {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background: $color-primary;
    }

    &--emit {
      width: 16px;
      border-top: 2px dashed var(--text-faint);
    }
  }

  &__plot {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    grid-template-rows: 13rem auto;
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
      transform: translateY(50%);
    }
  }

  &__area {
    position: relative;
  }

  &__gridline {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: $color-line;
  }

  &__emissions {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;

    polyline {
      fill: none;
      stroke: var(--text-faint);
      stroke-width: 2;
      stroke-dasharray: 5 4;
      vector-effect: non-scaling-stroke;
    }
  }

  &__bars {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  &__col {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    outline: none;

    &:focus-visible {
      background: var(--fill-1);
    }
  }

  &__bar {
    width: 52%;
    max-width: 3.5rem;
    min-height: 2px;
    border-radius: 4px 4px 0 0;
    background: $color-primary;
    opacity: 0.45;
    transition: opacity $default-transition-time;
  }

  &__col--deflationary &__bar {
    opacity: 1;
    box-shadow: 0 0 24px var(--accent-soft);
  }

  &__col:hover &__bar {
    opacity: 1;
  }

  &__emit-dot {
    position: absolute;
    left: 50%;
    z-index: 3;
    width: 8px;
    height: 8px;
    border: 2px solid var(--text-faint);
    border-radius: 50%;
    background: $color-surface;
    transform: translate(-50%, 50%);
  }

  &__tip {
    position: absolute;
    bottom: calc(100% - 0.5rem);
    left: 50%;
    z-index: 4;
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
    transform: translateX(-30%);
    pointer-events: none;

    strong {
      font-weight: 600;
      color: $color-title;
    }

    &--left {
      transform: translateX(-80%);
    }
  }

  &__x {
    grid-column: 2;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    margin-top: 0.5rem;

    span {
      font-family: $font-mono;
      font-size: 10px;
      text-align: center;
      color: $color-subtitle;
      white-space: nowrap;
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
