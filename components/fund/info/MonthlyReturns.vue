<template>
  <div class="monthly brand_card">
    <div class="brand_card__head">
      <div class="brand_card__eyebrow">
        Monthly returns
      </div>
      <div v-if="rows.length" class="brand_card__meta">
        {{ basis === "nav" ? "VAULT VALUE" : "SHARE PRICE" }} · UTC
      </div>
    </div>

    <div v-if="isLoading" class="monthly__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Reading share price history…
    </div>

    <!-- Said plainly rather than drawn as an empty grid: a table of dashes
         looks like a rendering fault, and a table of zeroes would be a lie. -->
    <div v-else-if="!rows.length" class="monthly__placeholder">
      {{ emptyReason }}
    </div>

    <div v-else class="monthly__scroll">
      <table class="monthly__table">
        <thead>
          <tr>
            <th class="monthly__th monthly__th--year">
              Year
            </th>
            <th
              v-for="month in MONTH_LABELS"
              :key="month"
              class="monthly__th"
            >
              {{ month }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.year" class="monthly__row">
            <td class="monthly__year">
              {{ row.year }}
            </td>
            <td
              v-for="(cell, index) in row.cells"
              :key="index"
              class="monthly__cell"
              :class="cell?.toneClass"
              :title="cell?.detail"
            >
              {{ cell ? cell.label : "-" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useActionStateStore } from "~/store/actionState.store";
import { ActionState } from "~/types/enums/action_state";
import {
  buildMonthlyReturns,
  type MonthlyReturn,
  type MonthlyReturnBasis,
} from "~/composables/monthlyReturns";
import { formatDate, formatNumberShort } from "~/composables/formatters";

/**
 * What the vault returned in each calendar month, laid out as a year per row.
 *
 * The figures are share price to share price — see composables/monthlyReturns
 * for why that is the basis and what is deliberately left blank. Months are
 * bucketed in UTC, which is the clock the chain keeps; naming it in the card's
 * meta line saves a reader wondering whose midnight a boundary is.
 */
const props = defineProps<{ fund: IFund }>();

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Below this a figure reads as flat, and a signed zero reads as a typo. */
const FLAT_THRESHOLD = 0.005;

/**
 * Both feeds are already on the fund — fetchFundNAVData loads them for the page
 * — so this card reads rather than fetches. Its own loading state is that
 * action's, since an empty list mid-flight is indistinguishable from a vault
 * that has none.
 */
const actionStateStore = useActionStateStore();

// NAV and supply ride along so a vault that never minted shares can still be
// measured — see shouldPriceFromNav in composables/monthlyReturns.
const navUpdates = computed(() =>
  (props.fund?.backendNavUpdates ?? []).map((update) => ({
    timestamp: update.timestamp,
    sharePrice: update.sharePrice,
    totalNav: update.totalNAV,
    totalSupply: update.totalSupply,
  })),
);
const dailySnapshots = computed(() =>
  (props.fund?.backendDailyNavSnapshots ?? []).map((snapshot) => ({
    timestamp: snapshot.timestamp,
    sharePrice: snapshot.sharePrice,
    totalNav: snapshot.totalSimulatedNav,
    totalSupply: snapshot.totalSupply,
  })),
);

const isLoading = computed(() =>
  [
    `fetchFundNavUpdates_${props.fund?.chainId}_${props.fund?.address}`,
    `fetchFundDailyNavSnapshots_${props.fund?.chainId}_${props.fund?.address}`,
  ].some((key) => actionStateStore.isActionState(key, ActionState.Loading)),
);

const monthlyReturns = computed<MonthlyReturn[]>(() =>
  buildMonthlyReturns(navUpdates.value, dailySnapshots.value),
);

const basis = computed<MonthlyReturnBasis>(
  () => monthlyReturns.value[0]?.basis ?? "sharePrice",
);

const emptyReason = computed(() =>
  navUpdates.value.length
    ? "Not enough share price history to measure a month yet."
    : "This vault has not recorded a settlement, so it has no share price history.",
);

interface Cell {
  label: string;
  toneClass: string;
  detail: string;
}

const toCell = (entry: MonthlyReturn): Cell => {
  const isFlat = Math.abs(entry.percent) < FLAT_THRESHOLD;
  return {
    // No plus on gains: colour already carries the direction, and dropping it
    // keeps the columns narrow enough to read thirteen of them across. Zero is
    // written unsigned too, so a rounding artefact cannot masquerade as a
    // direction the vault did not move in.
    label: isFlat ? "0.00%" : `${entry.percent.toFixed(2)}%`,
    toneClass: isFlat
      ? ""
      : entry.percent > 0
        ? "monthly__cell--pos"
        : "monthly__cell--neg",
    // Every figure can show its working: the two readings it came from and
    // when they were recorded.
    detail:
      `${formatDate(new Date(entry.fromTimestamp))} → ` +
      `${formatDate(new Date(entry.toTimestamp))}\n` +
      `${entry.basis === "nav" ? "vault value" : "share price"} ` +
      `${formatReading(entry.fromPrice, entry.basis)} → ` +
      `${formatReading(entry.toPrice, entry.basis)}`,
  };
};

/**
 * A NAV is a real quantity of the base asset and is worth showing as one. A
 * share price is not: the backend reports it on a scale of its own, so this
 * shows enough digits to see the move and makes no claim beyond that.
 */
const formatReading = (value: number, basis: MonthlyReturnBasis) => {
  const decimals = props.fund?.baseToken?.decimals;
  if (basis === "nav" && decimals != null) {
    const symbol = props.fund?.baseToken?.symbol ?? "";
    return `${formatNumberShort(value / 10 ** decimals)} ${symbol}`.trim();
  }
  return value.toLocaleString("en-US", { maximumSignificantDigits: 6 });
};

const rows = computed(() => {
  const byYear = new Map<number, (Cell | null)[]>();

  for (const entry of monthlyReturns.value) {
    if (!byYear.has(entry.year)) {
      byYear.set(entry.year, Array.from({ length: 12 }, () => null));
    }
    byYear.get(entry.year)![entry.month - 1] = toCell(entry);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, cells]) => ({ year, cells }));
});
</script>

<style scoped lang="scss">
.monthly {
  &__placeholder {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 1.25rem 0 0.25rem;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  /* Thirteen columns will not fit a narrow viewport at a legible size, so the
     table scrolls inside the card rather than the page scrolling under it. */
  &__scroll {
    overflow-x: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
  }

  /* The widths are hints, not a fixed layout: thirteen columns of figures do
     not fit a vault page at every window, and a fixed split would size every
     column to the same share whether or not the figure in it fits — a vault
     with three-digit percentages would spill its cells into their neighbours.
     Letting content win means the table asks for the room it actually needs and
     the container scrolls only when the window cannot give it. */
  &__th {
    width: 7.6%;
    padding: 0 0.5rem 0.625rem;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: right;
    color: $color-steel-blue;

    &--year {
      width: 8.8%;
      text-align: left;
    }
  }

  &__row {
    border-top: 1px solid $color-line;

    &:hover {
      background: $color-navy-gray-light;
    }
  }

  &__year {
    padding: 0.8125rem 0.5rem;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
  }

  &__cell {
    padding: 0.8125rem 0.5rem;
    font-family: $font-mono;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
    /* A month with no observation, which is not the same as a flat month. */
    color: $color-inactive;

    &--pos {
      color: $color-pos;
    }

    &--neg {
      color: $color-neg;
    }
  }
}
</style>
