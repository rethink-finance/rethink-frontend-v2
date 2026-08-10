<template>
  <div v-if="rows.length || isSimulating" class="composition brand_card">
    <div class="brand_card__head">
      <div class="composition__head_left">
        <div class="brand_card__eyebrow">
          Composition
        </div>
        <UiSegmented v-model="view" :options="VIEW_OPTIONS" />
      </div>
    </div>

    <div v-if="isSimulating || !rows.length" class="composition__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Valuing positions…
    </div>

    <div v-else-if="view === 'pie'" class="composition__pie_layout">
      <svg viewBox="0 0 200 200" class="composition__donut">
        <path
          v-for="row in rows"
          :key="row.name"
          :d="row.path"
          :fill="row.dot"
          fill-rule="evenodd"
        />
      </svg>
      <div class="composition__legend">
        <div v-for="row in rows" :key="row.name" class="composition__legend_row">
          <span class="composition__dot" :style="{ background: row.dot }" />
          <span class="composition__name">{{ row.name }}</span>
          <span class="composition__amount">{{ row.amount }}</span>
          <span class="composition__share">{{ row.share }}</span>
        </div>
        <div class="composition__total_row">
          <span class="composition__total_label">Total</span>
          <span class="composition__total_value">{{ totalFormatted }}</span>
          <span class="composition__share composition__share--dim">100.0%</span>
        </div>
      </div>
    </div>

    <div v-else class="composition__table">
      <div class="composition__grid composition__grid--head">
        <div class="composition__th">
          Position
        </div>
        <div class="composition__th composition__th--right">
          Amount
        </div>
        <div class="composition__th composition__th--right">
          Share
        </div>
        <div class="composition__th">
          Proportion
        </div>
      </div>
      <div v-for="row in rows" :key="row.name" class="composition__grid">
        <div class="composition__cell_name">
          <span
            class="composition__dot composition__dot--small"
            :style="{ background: row.dot }"
          />
          <span class="composition__name">{{ row.name }}</span>
        </div>
        <div class="composition__amount composition__amount--right">
          {{ row.amount }}
        </div>
        <div class="composition__share composition__share--dim">
          {{ row.share }}
        </div>
        <div class="composition__bar">
          <div
            class="composition__bar_fill"
            :style="{ width: row.share, background: row.dot }"
          />
        </div>
      </div>
      <div class="composition__grid composition__grid--total">
        <div class="composition__total_label">
          Total
        </div>
        <div class="composition__amount composition__amount--right">
          {{ totalFormatted }}
        </div>
        <div class="composition__share composition__share--dim">
          100.0%
        </div>
        <div />
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

const VIEW_OPTIONS = [
  { key: "pie", label: "Pie" },
  { key: "table", label: "Table" },
];
const view = ref("pie");

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
    .map(([name, raw]) => ({ name, raw, value: toNumber(raw) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  if (merged.length > MAX_SLICES + 1) {
    const rest = merged.splice(MAX_SLICES);
    merged.push({
      name: `Other (${rest.length} positions)`,
      raw: rest.reduce((sum, p) => sum + p.raw, 0n),
      value: rest.reduce((sum, p) => sum + p.value, 0),
    });
  }

  return merged;
});

const rows = computed(() =>
  buildDonutSlices(positions.value, (position) => position.value).map(
    (slice) => ({
      name: slice.item.name,
      amount: fundStore.getFormattedBaseTokenValue(slice.item.raw),
      share: `${(slice.fraction * 100).toFixed(1)}%`,
      dot: slice.color,
      path: slice.path,
    }),
  ),
);

const totalFormatted = computed(() =>
  fundStore.getFormattedBaseTokenValue(
    positions.value.reduce((sum, p) => sum + p.raw, 0n),
  ),
);
</script>

<style lang="scss" scoped>
.composition {
  &__head_left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

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

  &__pie_layout {
    display: flex;
    align-items: center;
    gap: 3rem;
    flex-wrap: wrap;
    padding: 0.5rem 0 0.25rem;
  }

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
    min-width: 260px;
    flex: 1;
  }

  &__legend_row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 2px;

    &--small {
      width: 7px;
      height: 7px;
      border-radius: 999px;
    }
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    color: $color-white;
    @include ellipsis;
  }

  &__amount {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;

    &--right {
      text-align: right;
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

    &--dim {
      color: $color-text-irrelevant;
    }
  }

  &__total_row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-top: 1px solid $color-line;
    padding-top: 0.75rem;
  }

  &__total_label {
    flex: 1;
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

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(92px, auto) 56px minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid $color-line;

    &--head {
      padding: 0 0 0.625rem;
      border-top: 0;
    }

    &--total {
      border-top: 1px solid $color-line-2;
      padding-bottom: 0;

      .composition__total_label {
        flex: none;
      }
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

  &__bar {
    height: 5px;
    border-radius: 999px;
    background: $color-hover;
    overflow: hidden;
  }

  &__bar_fill {
    height: 100%;
  }
}
</style>
