<template>
  <div class="positions_pie">
    <svg viewBox="0 0 200 200" class="positions_pie__donut">
      <!-- fill via style, not the attribute: the palette is var() refs and
           var() does not resolve in SVG presentation attributes. -->
      <path
        v-for="slice in slices"
        :key="slice.item.key"
        :d="slice.path"
        :style="{ fill: slice.color }"
        fill-rule="evenodd"
      />
    </svg>

    <div class="positions_pie__legend">
      <div
        v-for="slice in slices"
        :key="slice.item.key"
        class="positions_pie__row"
        @click="emit('open', slice.item.key)"
      >
        <span
          class="positions_pie__swatch"
          :style="{ background: slice.color }"
        />
        <span class="positions_pie__name">{{ slice.item.fund.title }}</span>
        <span class="positions_pie__value">
          {{ formatUSD(slice.item.valueUSD) }}
        </span>
        <span class="positions_pie__share">
          {{ (slice.fraction * 100).toFixed(1) }}%
        </span>
      </div>

      <div class="positions_pie__total">
        <span class="positions_pie__total_label">Total</span>
        <span class="positions_pie__value positions_pie__value--strong">
          {{ formatUSD(total) }}
        </span>
        <span class="positions_pie__share">100.0%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildDonutSlices } from "~/composables/donut";
import { formatNumberShort } from "~/composables/formatters";
import type { PricedPosition } from "~/composables/portfolioPositions";

/**
 * The same positions as the table, read as shares of one whole. Sorted
 * descending by value so the ring reads clockwise from the largest holding,
 * which is the order the legend is already in.
 */
const props = defineProps<{
  positions: PricedPosition[];
}>();

const emit = defineEmits<{
  (e: "open", key: string): void;
}>();

const ordered = computed(() =>
  [...props.positions].sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0)),
);

const slices = computed(() =>
  buildDonutSlices(ordered.value, (position) => position.valueUSD ?? 0),
);

const total = computed(() =>
  props.positions.reduce((sum, position) => sum + (position.valueUSD ?? 0), 0),
);

// A vault with no USD quote has no slice, so its row would read "N/A" against
// a share it does not have. Saying nothing is the truer answer.
const formatUSD = (value?: number) =>
  value ? `$${formatNumberShort(value)}` : "—";
</script>

<style lang="scss" scoped>
.positions_pie {
  display: flex;
  align-items: center;
  gap: 3rem;
  flex-wrap: wrap;
  padding: 0.25rem 1.875rem 1.875rem;

  /* No rotation: the segment paths already start at twelve o'clock. */
  &__donut {
    width: 210px;
    height: 210px;
    flex: none;
    display: block;
  }

  &__legend {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 280px;
    flex: 1;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: color $default-transition-time ease;

    &:hover .positions_pie__name {
      color: $color-cyan;
    }
  }

  &__swatch {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    color: $color-white;
    transition: color $default-transition-time ease;
    @include ellipsis;
  }

  &__value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;

    &--strong {
      color: $color-white;
    }
  }

  &__share {
    width: 58px;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  &__total {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid $color-line;
  }

  &__total_label {
    flex: 1;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }
}
</style>
