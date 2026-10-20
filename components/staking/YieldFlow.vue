<template>
  <div class="flow" :style="{ '--flow-color': `var(--asset-${asset.symbol.toLowerCase()})` }">
    <div
      ref="canvas"
      class="flow__canvas"
      :style="{ height: `${HEIGHT}px` }"
      @mouseleave="active = null"
    >
      <svg
        class="flow__ribbons"
        :viewBox="`0 0 1000 ${HEIGHT}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g v-for="(band, index) in bands" :key="index" :class="ribbonClass(index)">
          <path :d="ribbonPath(0, COLUMNS[1] * 10, band.from, band.to)" />
          <path :d="ribbonPath(COLUMNS[1] * 10, COLUMNS[2] * 10, band.to, band.to)" />
        </g>
      </svg>

      <span class="flow__node" :style="{ left: '0%', top: '0px', height: `${HEIGHT}px` }" />
      <span
        v-for="(band, index) in bands"
        :key="`venue${index}`"
        class="flow__node"
        :class="nodeClass(index)"
        :style="nodeStyle(COLUMNS[1], band.to)"
      />
      <span
        v-for="(band, index) in bands"
        :key="`position${index}`"
        class="flow__node"
        :class="nodeClass(index)"
        :style="nodeStyle(COLUMNS[2], band.to)"
      />

      <div class="flow__total">
        <span class="flow__total-label">Total</span>
        <span class="flow__total-value">{{ amountLabel }} {{ asset.symbol }}</span>
      </div>

      <button
        v-for="(row, index) in rows"
        :key="row.source.name"
        type="button"
        class="flow__venue"
        :class="{ 'flow__venue--dim': active !== null && active !== index }"
        :style="{ ...labelStyle(COLUMNS[1], bands[index].to), maxWidth: `calc(${COLUMNS[2] - COLUMNS[1]}% - 22px)` }"
        :aria-label="`${row.source.name}: ${row.pct} of ${asset.symbol}, into ${row.source.position}`"
        @mouseenter="active = index"
        @focus="active = index"
        @blur="active = null"
      >
        <OnboardingProtocolLogo
          v-if="row.source.logo"
          :protocol="row.source.logo"
          :label="row.source.name"
          :size="18"
        />
        <span v-else class="flow__generic"><Icon icon="mdi:server-outline" width="0.75rem" /></span>
        <span class="flow__venue-name">{{ row.source.name }}</span>
        <span class="flow__venue-pct">{{ row.pct }}</span>
      </button>

      <span
        v-for="(row, index) in rows"
        :key="`p${row.source.name}`"
        class="flow__position"
        :class="{ 'flow__venue--dim': active !== null && active !== index }"
        :style="{ ...labelStyle(COLUMNS[2], bands[index].to), maxWidth: `calc(${100 - COLUMNS[2]}% - 14px)` }"
        aria-hidden="true"
      >
        {{ row.source.position }}
      </span>

      <p
        v-if="active !== null"
        class="flow__tip"
        :class="{ 'flow__tip--above': active >= rows.length / 2 }"
        :style="tipStyle(bands[active].to)"
        aria-live="polite"
      >
        <strong>{{ rows[active].amountLabel }} {{ asset.symbol }}</strong>
        {{ formatUsdCompact(rows[active].usd) }} in {{ rows[active].source.name }}
        <span>earning ~{{ formatRate(rows[active].source.apy) }} a year</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  formatAmount,
  formatCompact,
  formatRate,
  formatUsdCompact,
} from "~/composables/staking/formatStaking";
import type {
  VentureAsset,
  VentureYieldStrategy,
} from "~/composables/staking/ventureStakingConfig";
import { ribbonPath, yieldFlowBands } from "~/composables/staking/yieldFlow";

const props = defineProps<{
  asset: VentureAsset;
  amount: number;
  strategy: VentureYieldStrategy;
}>();

const HEIGHT = 220;
const GAP = 10;
/**
 * Left edge of each column, in percent of the width. A narrow card pulls the
 * last two in so the position labels keep room on the right.
 */
const canvas = ref<HTMLElement>();
const canvasWidth = ref(0);
const positionWidth = ref(0);

/** Width of the longest position name (stETH, steakUSDC) now on screen. */
const measurePositions = () => {
  const labels = canvas.value?.querySelectorAll<HTMLElement>(".flow__position") ?? [];
  positionWidth.value = Math.max(0, ...[...labels].map((label) => label.scrollWidth));
};

/**
 * Left edge of each column, in percent of the width. The last column sits
 * so its longest name ends at the card's edge, giving the ribbons all the
 * room the short names do not need; the middle column halves what is left.
 */
const COLUMNS = computed(() => {
  const width = canvasWidth.value;
  if (!width || !positionWidth.value) return [0, 42, 84];
  const last = ((width - positionWidth.value - 14 - 2) / width) * 100;
  const clamped = Math.min(Math.max(last, 60), 94);
  return [0, clamped / 2, clamped];
});

let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    canvasWidth.value = entry.contentRect.width;
  });
  if (canvas.value) observer.observe(canvas.value);
  measurePositions();
});
onUnmounted(() => observer?.disconnect());

// Another asset brings other names; measure once they are on screen.
watch(() => props.strategy, () => nextTick(measurePositions));

const active = ref<number | null>(null);
watch(() => props.asset.symbol, () => { active.value = null; });

const format = (value: number) =>
  props.asset.symbol === "USDC" ? formatCompact(value) : formatAmount(value, 2);

const amountLabel = computed(() => format(props.amount));

const bands = computed(() =>
  yieldFlowBands(props.strategy.sources.map((source) => source.weight), HEIGHT, GAP),
);

const rows = computed(() =>
  props.strategy.sources.map((source) => {
    const amount = props.amount * source.weight;
    return {
      source,
      pct: `${Math.round(source.weight * 100)}%`,
      amountLabel: format(amount),
      usd: amount * props.asset.priceUsd,
    };
  }),
);

const nodeStyle = (left: number, [top, bottom]: [number, number]) => ({
  left: `${left}%`,
  top: `${top}px`,
  height: `${bottom - top}px`,
});

const labelStyle = (left: number, [top, bottom]: [number, number]) => ({
  left: `calc(${left}% + 14px)`,
  top: `${(top + bottom) / 2}px`,
});

/** Under the hovered venue's label, or over it for the lower half. */
const tipStyle = ([top, bottom]: [number, number]) => ({
  left: `calc(${COLUMNS.value[1]}% + 14px)`,
  top: `${(top + bottom) / 2}px`,
});

const ribbonClass = (index: number) => ({
  flow__ribbon: true,
  "flow__ribbon--active": active.value === index,
  "flow__ribbon--dim": active.value !== null && active.value !== index,
});

const nodeClass = (index: number) => ({
  "flow__node--dim": active.value !== null && active.value !== index,
});
</script>

<style scoped lang="scss">
.flow {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__canvas {
    position: relative;
  }

  &__ribbons {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  &__ribbon path {
    fill: var(--flow-color);
    fill-opacity: 0.2;
    transition: fill-opacity $default-transition-time;
  }

  &__ribbon--active path {
    fill-opacity: 0.45;
  }

  &__ribbon--dim path {
    fill-opacity: 0.07;
  }

  &__node {
    position: absolute;
    width: 6px;
    border-radius: 2px;
    background: var(--flow-color);
    transition: opacity $default-transition-time;

    &--dim {
      opacity: 0.35;
    }
  }

  &__total {
    position: absolute;
    top: 50%;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    transform: translateY(-50%);
    pointer-events: none;
  }

  &__total-label {
    font-size: $text-xs;
    color: $color-subtitle;
  }

  &__total-value {
    font-family: $font-mono;
    font-size: $text-md;
    font-weight: 600;
    color: $color-title;
    white-space: nowrap;
  }

  &__venue,
  &__position {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    transform: translateY(-50%);
    font-size: $text-sm;
    color: $color-title;
    white-space: nowrap;
    transition: opacity $default-transition-time;
  }

  &__venue {
    padding: 0.125rem 0.25rem 0.125rem 0;
    border-radius: $default-border-radius;

    &:focus-visible {
      outline: 1px solid var(--accent-line);
    }
  }

  &__venue--dim {
    opacity: 0.4;
  }

  &__generic {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1px solid $color-line-2;
    border-radius: 50%;
    color: $color-subtitle;
  }

  &__venue-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__venue-pct,
  &__position {
    font-family: $font-mono;
    font-size: $text-xs;
  }

  &__venue-pct {
    color: $color-subtitle;
  }

  &__position {
    overflow: hidden;
    text-overflow: ellipsis;
    color: $color-title;
  }


  &__tip {
    position: absolute;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: var(--surface-float);
    box-shadow: var(--shadow-float);
    font-family: $font-mono;
    font-size: $text-xs;
    color: $color-subtitle;
    white-space: nowrap;
    transform: translateY(16px);
    pointer-events: none;

    strong {
      font-weight: 600;
      color: $color-title;
    }

    &--above {
      transform: translateY(calc(-100% - 16px));
    }
  }

  @media (max-width: $screen-sm) {
    &__venue-pct {
      display: none;
    }
  }
}
</style>
