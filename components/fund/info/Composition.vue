<template>
  <div v-if="rows.length || isSimulating" class="composition brand_card">
    <div class="brand_card__head">
      <div class="brand_card__eyebrow">
        Composition
      </div>
    </div>

    <div v-if="isSimulating || !rows.length" class="composition__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Valuing positions…
    </div>

    <div v-else-if="showDonut" class="composition__pie_layout">
      <div class="composition__ring">
        <svg viewBox="0 0 200 200" class="composition__donut">
          <path
            v-for="row in rows"
            :key="row.name"
            :d="row.path"
            :fill="row.dot"
            fill-rule="evenodd"
            class="composition__slice"
            :class="{
              'composition__slice--active': hoveredName === row.name,
              'composition__slice--dim': hoveredName && hoveredName !== row.name,
            }"
            @mouseenter="hoveredName = row.name"
            @mouseleave="hoveredName = null"
          />
        </svg>

        <!-- The hole reads what the ring cannot: what the whole is worth while
             nothing is pointed at, and what one slice is worth of it while
             something is. -->
        <div class="composition__hub">
          <span class="composition__hub_value">{{ hub.value }}</span>
          <span class="composition__hub_label">{{ hub.label }}</span>
        </div>
      </div>

      <div class="composition__legend">
        <div class="composition__legend_row composition__legend_row--head">
          <span class="composition__cell_name">
            <span class="composition__name">Position</span>
          </span>
          <span class="composition__amount">Amount</span>
          <span class="composition__share">Share</span>
        </div>
        <div
          v-for="row in rows"
          :key="row.name"
          class="composition__legend_row"
          :class="{
            'composition__legend_row--active': hoveredName === row.name,
            'composition__legend_row--faded':
              hoveredName && hoveredName !== row.name,
          }"
          @mouseenter="hoveredName = row.name"
          @mouseleave="hoveredName = null"
        >
          <!-- Swatch and name are one cell, so the row can space its three
               columns apart without the swatch drifting off its label. -->
          <span class="composition__cell_name">
            <span class="composition__dot" :style="{ background: row.dot }" />
            <span class="composition__name">{{ row.name }}</span>
          </span>
          <span class="composition__amount">{{ row.amount }}</span>
          <span class="composition__share">{{ row.share }}</span>
        </div>
        <div class="composition__total_row">
          <span class="composition__total_label">Total</span>
          <span class="composition__total_value">{{ totalFormatted }}</span>
          <span class="composition__share">100.0%</span>
        </div>
      </div>
    </div>

    <!-- Too few holdings for a ring: two slices are a number said twice, one
         is a circle that reads as a spinner. The same rows, measured against
         the largest instead, which is a comparison a bar can actually make. -->
    <div v-else class="composition__table">
      <div class="composition__grid composition__grid--head">
        <div class="composition__th">
          Position
        </div>
        <div class="composition__th composition__th--bar">
          Proportion
        </div>
        <div class="composition__th composition__th--right">
          Amount
        </div>
        <div class="composition__th composition__th--right">
          Share
        </div>
      </div>
      <div v-for="row in rows" :key="row.name" class="composition__grid">
        <div class="composition__cell_name">
          <span class="composition__dot" :style="{ background: row.dot }" />
          <span class="composition__name">{{ row.name }}</span>
        </div>
        <div class="composition__bar">
          <div
            class="composition__bar_fill"
            :style="{ width: row.bar, background: row.dot }"
          />
        </div>
        <div class="composition__amount">
          {{ row.amount }}
        </div>
        <div class="composition__share">
          {{ row.share }}
        </div>
      </div>
      <div class="composition__grid composition__grid--total">
        <div class="composition__total_label">
          Total
        </div>
        <div class="composition__bar_spacer" />
        <div class="composition__total_value">
          {{ totalFormatted }}
        </div>
        <div class="composition__share">
          100.0%
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { useFundStore } from "~/store/fund/fund.store";
import { useActionStateStore } from "~/store/actionState.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

/**
 * What the vault holds right now, per the design's Composition card: one slice
 * per NAV method, each valued by simulating the method against current chain
 * state rather than reading back the last NAV update. That costs one call per
 * method, so the simulation is kicked off here and the card fills in as the
 * results land.
 */
const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
});

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();

// One hover state shared by the slices and the legend, so pointing at either
// highlights both — the slice says which row, the row says what it is worth.
// Keyed by row name.
const hoveredName = ref<string | null>(null);

// The method list is what defines the vault's positions; re-simulate whenever
// it changes (including the first time it arrives).
watch(
  () => fundStore.fundNavMethods,
  () => {
    fundStore.simulateCurrentNAV();
  },
  { immediate: true },
);

const isSimulating = computed(() =>
  actionStateStore.isActionState(
    "fetchSimulateCurrentNAVAction",
    ActionState.Loading,
  ),
);

/**
 * Real vaults value the same position across many NAV methods (staked and
 * unstaked legs, dust) — one vault on Base has 27. The design's card shows a
 * handful of slices, so methods merge by position name and everything beyond
 * the largest five folds into "Other".
 */
const MAX_SLICES = 5;

/**
 * Below this the ring is drawn as a bar chart instead. A vault holding one
 * position gets a closed 100% ring — the largest, brightest thing on its page,
 * saying only that it holds one thing, and reading as a loading spinner while
 * it says it. Two positions is a single number the legend already prints.
 */
const MIN_DONUT_SLICES = 3;

const positions = computed(() => {
  const decimals = props.fund?.baseToken?.decimals;
  if (decimals == null) return [];

  const toNumber = (value: bigint) => Number(ethers.formatUnits(value, decimals));

  const byName = new Map<string, bigint>();
  for (const method of fundStore.fundNavMethods) {
    // Strictly the simulated value — never the method's pastNavValue. Vaults
    // keep methods around for positions they have since closed (INDEFI has 20+
    // that now simulate to 0), and those carry stale, sometimes wildly wrong
    // historical values. A method worth nothing today is not a missing slice.
    if (!method.simulatedNav) continue;
    const name = method.positionName || "Unnamed position";
    byName.set(name, (byName.get(name) ?? 0n) + method.simulatedNav);
  }

  // Everything held outside a valuation method is plain base asset — idle on
  // the Safe or the admin contract, plus accrued fees — so it goes in under
  // the asset's own ticker. Same three balances the store adds in
  // totalCurrentSimulatedNAV, which keeps this card's total equal to the
  // vault's current NAV.
  const baseAssetHoldings =
    (props.fund?.fundContractBaseTokenBalance ?? 0n) +
    (props.fund?.safeContractBaseTokenBalance ?? 0n) +
    (props.fund?.feeBalance ?? 0n);

  if (baseAssetHoldings > 0n) {
    const symbol = props.fund?.baseToken?.symbol || "Base asset";
    byName.set(symbol, (byName.get(symbol) ?? 0n) + baseAssetHoldings);
  }

  const merged = [...byName.entries()]
    .map(([name, raw]) => ({ name, raw, value: toNumber(raw), isOther: false }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  if (merged.length > MAX_SLICES + 1) {
    const rest = merged.splice(MAX_SLICES);
    merged.push({
      name: `Other (${rest.length} positions)`,
      raw: rest.reduce((sum, p) => sum + p.raw, 0n),
      value: rest.reduce((sum, p) => sum + p.value, 0),
      isOther: true,
    });
  }

  return merged;
});

/**
 * The ring reads as separate holdings rather than one continuous band, so the
 * slices are set apart. 0.03rad is ~2.6 units at the outer edge of the
 * 200-unit viewBox — a hairline of the card behind, not a wedge.
 */
const COMPOSITION_DONUT = { ...DEFAULT_DONUT, gap: 0.03 };

const rows = computed(() => {
  const slices = buildDonutSlices(
    positions.value,
    (position) => position.value,
    COMPOSITION_DONUT,
  );
  const largest = slices.reduce((max, slice) => Math.max(max, slice.fraction), 0);

  return slices.map((slice) => ({
    name: slice.item.name,
    amount: fundStore.getFormattedBaseTokenValue(slice.item.raw),
    share: `${(slice.fraction * 100).toFixed(1)}%`,
    /* Measured against the largest holding rather than against the vault. A
       bar scaled to the whole leaves the widest row in a five-position vault
       filling a third of its track and every row under it a stub in an empty
       gutter — the column reads as the grey it mostly is. */
    bar: `${largest ? (slice.fraction / largest) * 100 : 0}%`,
    dot: slice.item.isOther ? DONUT_OTHER_COLOR : slice.color,
    path: slice.path,
  }));
});

const showDonut = computed(() => rows.value.length >= MIN_DONUT_SLICES);

const totalFormatted = computed(() =>
  fundStore.getFormattedBaseTokenValue(
    positions.value.reduce((sum, p) => sum + p.raw, 0n),
  ),
);

/**
 * What the hole says. The vault's total, short enough to sit inside it, until
 * a slice is pointed at — then that slice's own share, which is the reading
 * the ring is drawn to give and the one the pointer is asking for.
 */
const hub = computed(() => {
  const hovered = rows.value.find((row) => row.name === hoveredName.value);
  if (hovered) return { value: hovered.share, label: hovered.name };

  const count = rows.value.length;
  const total = positions.value.reduce((sum, p) => sum + p.value, 0);
  const symbol = props.fund?.baseToken?.symbol ?? "";

  return {
    value: `${formatNumberShort(total)} ${symbol}`.trim(),
    label: `${count} position${count === 1 ? "" : "s"}`,
  };
});
</script>

<style lang="scss" scoped>
.composition {
  /* Held until every method has reported. Rendering partial results would
     briefly draw a full pie out of whichever positions happened to land
     first — the idle base asset alone reads as "100% USDC". */
  &__placeholder {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 0;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }

  /* Ring left, legend right, the slack between them rather than inside either.
     Space-between is what keeps the legend's figures on the card's own right
     margin, in line with the tables in the cards above and below it. */
  /* The overview's shared table grid, with the ring standing in the first
     track. That is what puts the legend's position names under the activity
     list's operations and its amounts under the activity list's amounts: the
     legend is not placed beside the ring, it is placed on the same columns
     every other card on the page resolves against.

     Stacked below the tablet width, where those tracks have nothing to align
     to — every card is a single column there. */
  &__pie_layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 1.5rem;
    padding: 0.5rem 0 0.25rem;

    @include md {
      grid-template-columns: $details-table-columns;
      column-gap: $details-table-gap;
      row-gap: 0;
      align-items: center;
    }
  }

  /* The ring and the reading inside it are one block, so the hub centres on
     the ring rather than on whatever is left of the row. Centred in its track
     rather than pinned to its left edge: the first track is a share of the
     card and grows past the ring on a wide one, and a ring hugging the far
     left of it drifts away from the legend it belongs to. */
  &__ring {
    position: relative;
    width: min(100%, 240px);
    aspect-ratio: 1;

    @include md {
      grid-column: 1;
      justify-self: center;
    }
  }

  /* No rotation: the segment paths already start at twelve o'clock. */
  &__donut {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Sits in the hole, never over the slices: the inner radius is 53% of the
     ring's width, so the text stops well inside that. Transparent to the
     pointer, or it would shadow the slices it is centred on and cancel the
     hover it exists to report. */
  &__hub {
    @include transform-center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    width: 46%;
    text-align: center;
    pointer-events: none;
  }

  &__hub_value {
    width: 100%;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
    @include ellipsis;
  }

  &__hub_label {
    font-family: $font-mono;
    font-size: 10.5px;
    line-height: 1.3;
    color: $color-steel-blue;
    /* A hovered position's name goes here, and some of them are long. Two
       lines inside the hole, then ellipsis; the legend prints it in full. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__slice {
    cursor: pointer;
    /* Scaled about the ring's centre rather than the path's own box, so a
       slice grows outward along its own radius instead of drifting. */
    transform-box: view-box;
    transform-origin: 100px 100px;
    transition: opacity 0.2s ease, transform 0.2s ease;

    /* 87 → 90 on the outer radius. Enough to lift the slice off the ring,
       little enough that the gaps beside it stay even. */
    &--active {
      transform: scale(1.035);
    }

    /* And everything else steps back. */
    &--dim {
      opacity: 0.55;
    }
  }

  /* The legend occupies the three tracks the ring does not, as a subgrid, so
     its rows resolve against the page's columns rather than against the space
     left over beside the ring. Its own three-track grid below the tablet
     width, where the card is a single column and there is nothing to share. */
  &__legend {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 100px 46px;
    row-gap: 0.5rem;

    @include md {
      grid-column: 2 / -1;
      grid-template-columns: subgrid;
    }
  }

  /* Rows and the total alike are subgrids of the legend, so every cell lands
     on the same track the header above it and the card below it use. No
     horizontal padding: a subgrid's own padding is taken out of its first and
     last track, which would pull the columns off the ones they align to. The
     hover highlight runs flush with the columns instead. */
  &__legend_row,
  &__total_row {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
  }

  &__legend_row {
    padding: 0.3125rem 0;
    border-radius: 4px;
    transition: opacity 0.2s ease, background 0.2s ease;

    /* The row the pointer is on, whether it got there over the row or over the
       slice — the same highlight either way, so the ring and the legend read
       as one control. */
    &:hover,
    &--active {
      background: $color-hover;
    }

    &--faded {
      opacity: 0.65;
    }

    /* Column labels, so the legend is read under the same headings the table
       gives it. The row's own classes carry the columns — the name still takes
       the slack, the share still holds its width — so only the type changes
       here. Named individually to outweigh those classes, which are declared
       further down the sheet. */
    &--head {
      /* Headings, not a row: nothing to point at, and nothing to highlight. */
      pointer-events: none;

      .composition__name,
      .composition__amount,
      .composition__share {
        font-family: $font-mono;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: $color-steel-blue;
      }
    }
  }

  /* One square, both views: the legend's key and the table's are the same
     mark for the same slice. */
  &__dot {
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
    @include ellipsis;
  }

  /* The amount is the reading and the share supports it, in the legend and the
     table alike — so the pairing lives here rather than in a modifier each
     view had to remember to apply. */
  /* The amount is the reading and the share supports it, in the legend and the
     table alike. Right-aligned in both: the figures sit in the overview's
     third track, under the activity list's amounts, and a column of numbers is
     only comparable from its last digit. */
  &__amount,
  &__total_value {
    font-family: $font-mono;
    /* The longest string in the row, and the one the position's name is
       competing with for a phone's 294px. It gives first. */
    font-size: 11px;
    color: $color-white;
    white-space: nowrap;
    text-align: right;
    font-variant-numeric: tabular-nums;

    @include sm {
      font-size: 12.5px;
    }
  }

  /* No width of its own — the grid track carries it, in the legend and the
     table alike, which is what puts every share on the same edge as the
     activity list's timestamps. */
  &__share {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  &__total_row {
    border-top: 1px solid $color-line;
    padding-top: 0.75rem;
    margin-top: 0.25rem;
  }

  &__total_label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__total_value {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__table {
    display: flex;
    flex-direction: column;
  }

  /* The same four tracks as the legend above resolves against, so a vault
     holding two positions lists them under the columns a vault holding six
     lists its own — and under the activity list's below. The proportion bar
     stands in the second track, where the ring's legend puts the position
     name; the figures keep the third and fourth. */
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 100px 46px;
    align-items: center;
    column-gap: $details-table-gap;
    padding: 0.75rem 0;
    border-top: 1px solid $color-line;

    @include md {
      grid-template-columns: $details-table-columns;
    }

    &--head {
      padding: 0 0 0.625rem;
      border-top: 0;
    }

    &--total {
      border-top: 1px solid $color-line-2;
      padding-bottom: 0;
    }
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }
  }

  &__cell_name {
    display: flex;
    align-items: center;
    gap: 0.6875rem;
    min-width: 0;
  }

  /* Both the track and the total row's placeholder for it, so the header, the
     rows and the total keep the same column count at every width. */
  &__bar,
  &__bar_spacer,
  &__th--bar {
    display: none;

    @include md {
      display: block;
    }
  }

  &__bar {
    height: 5px;
    border-radius: 999px;
    background: $color-hover;
    overflow: hidden;
  }

  &__bar_fill {
    height: 100%;
    /* A position worth a rounding error still holds something; a bar drawn at
       its true width would be nothing at all. */
    min-width: 3px;
  }
}
</style>
