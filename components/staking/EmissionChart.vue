<template>
  <section class="emission brand_card" aria-labelledby="emission-title">
    <span id="emission-title" class="brand_card__eyebrow">Emission</span>

    <div class="emission__figures">
      <div>
        <span class="emission__value">{{ formatCompact(schedule[0]) }}</span>
        <span class="emission__label">REFI in month 1</span>
      </div>
      <div>
        <span class="emission__value">{{ formatCompact(yearOne) }}</span>
        <span class="emission__label">REFI in year one</span>
      </div>
      <div>
        <span class="emission__value">{{ formatRate(VENTURE_STAKING.monthlyDecay) }}</span>
        <span class="emission__label">Monthly decay</span>
      </div>
    </div>

    <div
      ref="plot"
      class="emission__plot"
      role="img"
      :aria-label="summary"
      @pointermove="onPointer"
      @pointerleave="hover = null"
    >
      <svg viewBox="0 0 71 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient
            id="emission-fill"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0" class="emission__stop-top" />
            <stop offset="1" class="emission__stop-bottom" />
          </linearGradient>
        </defs>
        <line
          v-for="month in [12, 24, 36, 48, 60]"
          :key="month"
          class="emission__grid"
          :x1="month"
          :x2="month"
          y1="0"
          y2="100"
        />
        <path class="emission__area" :d="areaPath" fill="url(#emission-fill)" />
        <path class="emission__line" :d="linePath" />
      </svg>

      <span
        v-if="currentMonth !== null"
        class="emission__now"
        :style="pointStyle(currentMonth)"
      >
        <span class="emission__now-label">Now</span>
      </span>

      <template v-if="hover !== null">
        <span class="emission__crosshair" :style="{ left: `${(hover / 71) * 100}%` }" />
        <span class="emission__dot" :style="pointStyle(hover)" />
        <span
          class="emission__tip"
          :class="{ 'emission__tip--left': hover > 50 }"
          :style="pointStyle(hover)"
        >
          <strong>Month {{ hover + 1 }}</strong>
          {{ formatInt(schedule[hover]) }} REFI
        </span>
      </template>
    </div>

    <div class="emission__axis" aria-hidden="true">
      <span v-for="year in 6" :key="year">Year {{ year }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatCompact, formatInt, formatRate } from "~/composables/staking/formatStaking";
import { emissionSchedule } from "~/composables/staking/ventureStaking";
import { VENTURE_STAKING } from "~/composables/staking/ventureStakingConfig";

defineProps<{
  /** 0-based month of the program, or null before launch. */
  currentMonth: number | null;
}>();

const schedule = emissionSchedule();
const peak = schedule[0];
const yearOne = schedule.slice(0, 12).reduce((sum, value) => sum + value, 0);

/** Plot y in viewBox units; the top 8% stays clear for the line's stroke. */
const yOf = (value: number) => 100 - (value / peak) * 92;

const linePath = schedule
  .map((value, month) => `${month === 0 ? "M" : "L"}${month},${yOf(value).toFixed(2)}`)
  .join(" ");
const areaPath = `${linePath} L71,100 L0,100 Z`;

const summary =
  `Monthly REFI emission over ${VENTURE_STAKING.emissionMonths} months, starting at ` +
  `${formatInt(peak)} and decaying ${formatRate(VENTURE_STAKING.monthlyDecay)} a month.`;

const pointStyle = (month: number) => ({
  left: `${(month / 71) * 100}%`,
  top: `${yOf(schedule[month])}%`,
});

const plot = ref<HTMLElement>();
const hover = ref<number | null>(null);

const onPointer = (event: PointerEvent) => {
  const rect = plot.value?.getBoundingClientRect();
  if (!rect?.width) return;
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  hover.value = Math.round(ratio * 71);
};
</script>

<style scoped lang="scss">
.emission {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__figures {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;

    div {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  }

  &__value {
    font-family: $font-mono;
    font-size: 1.375rem;
    font-weight: 600;
    color: $color-title;
  }

  &__label {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__plot {
    position: relative;
    // Grows into whatever height the tier ladder beside it sets. The svg is
    // pinned inside so its viewBox ratio cannot size the box instead.
    flex: 1 1 0;
    min-height: 11rem;
    margin-top: 0.5rem;
    cursor: crosshair;
    touch-action: pan-y;

    svg {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  }

  &__stop-top {
    stop-color: var(--primary);
    stop-opacity: 0.28;
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
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  &__now,
  &__dot {
    position: absolute;
    width: 10px;
    height: 10px;
    border: 2px solid $color-surface;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  &__now {
    background: $color-cyan-raw;
    box-shadow: 0 0 0 4px $color-cyan-tint;
  }

  &__now-label {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__dot {
    background: $color-primary;
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

  &__axis {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-subtitle;

    span {
      text-align: center;
    }
  }

  @media (max-width: $screen-sm) {
    &__axis span:nth-child(even) {
      visibility: hidden;
    }
  }
}
</style>
