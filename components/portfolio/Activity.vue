<template>
  <div class="activity brand_card">
    <div class="brand_card__head">
      <div class="activity__head_left">
        <div class="brand_card__eyebrow">
          Recent activity
        </div>
        <div class="activity__filters">
          <button
            v-for="filter in FILTERS"
            :key="filter.label"
            type="button"
            class="activity__filter"
            :class="{ 'activity__filter--active': activeFilter === filter.label }"
            @click="pickFilter(filter.label)"
          >
            <span
              v-if="filter.dot"
              class="activity__filter_dot"
              :style="{ background: filter.dot }"
            />
            {{ filter.label }}
          </button>
        </div>
      </div>
      <div class="brand_card__meta">
        {{ rows.length }}
        {{ rows.length === 1 ? "TRANSACTION" : "TRANSACTIONS" }}
      </div>
    </div>

    <div v-if="isLoading" class="activity__placeholder">
      <v-progress-circular size="16" width="2" indeterminate />
      Reading your transactions…
    </div>

    <div v-else-if="!allRows.length" class="activity__placeholder">
      No transactions yet - deposit into a vault from the Discover page.
    </div>

    <div v-else-if="!rows.length" class="activity__placeholder">
      No {{ activeFilter.toLowerCase() }} transactions.
    </div>

    <template v-else>
      <div class="activity__rows">
        <div v-for="row in pagedRows" :key="row.id" class="activity__row">
          <div class="activity__vault" @click="openVault(row)">
            <UiVaultTile
              :image="row.photoUrl"
              :symbol="row.symbol"
              :size="24"
            />
            <span class="activity__vault_name">{{ row.title }}</span>
          </div>

          <div class="activity__op">
            <span class="activity__dot" :style="{ background: row.dot }" />
            <span>{{ row.label }}</span>
          </div>

          <div class="activity__amount">
            <IconBaseAsset :symbol="row.amountSymbol" :size="15" />
            <span>{{ row.amount }}</span>
          </div>

          <div class="activity__when">
            <AddressLink
              v-if="row.txHash"
              :address="row.txHash"
              :chain-id="row.chainId"
              title="View transaction"
            >
              {{ row.when }}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </AddressLink>
            <span v-else>{{ row.when }}</span>
          </div>
        </div>
      </div>

      <UiPager v-model:page="page" :page-count="pageCount" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import type { ChainId } from "~/types/enums/chain_id";
import AddressLink from "~/components/common/AddressLink.vue";
import { formatTokenValue } from "~/composables/formatters";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import type { PortfolioFlow } from "~/composables/portfolioPositions";
import {
  OPERATION_DOT_DEPOSIT,
  OPERATION_DOT_REDEEM,
  operationDot,
  operationGroup,
  resolveVaultOperation,
  type OperationFamily,
} from "~/composables/vaultOperations";

/**
 * What the wallet has done, newest first — the third question the page answers,
 * after what needs attention and how things are going.
 *
 * Requests and the settled operations they become are both shown: they are two
 * events in the depositor's own timeline, even though only one of them moved
 * any money.
 */
const props = defineProps<{
  flows: PortfolioFlow[];
  funds: IFund[];
  isLoading: boolean;
}>();

const PAGE_SIZE = 5;
const page = ref(1);

/**
 * The vault's own table offers a Settlement filter as well; there is nothing to
 * put behind it here, because this list holds only what the wallet itself
 * signed and a settlement is the vault's own transaction.
 */
const FILTERS: { label: string; group?: OperationFamily; dot: string }[] = [
  { label: "All", dot: "" },
  { label: "Deposit", group: "deposit", dot: OPERATION_DOT_DEPOSIT },
  { label: "Withdraw", group: "withdraw", dot: OPERATION_DOT_REDEEM },
];

const activeFilter = ref("All");

const pickFilter = (label: string) => {
  if (activeFilter.value === label) return;
  activeFilter.value = label;
  page.value = 1;
};

const router = useRouter();
const { getFundDetailsUrl } = usePageNavigation();

const fundByKey = computed(() => {
  const map = new Map<string, IFund>();
  for (const fund of props.funds) {
    map.set(`${fund.chainId}-${fund.address.toLowerCase()}`, fund);
  }
  return map;
});

/** "3 hours ago", "2 weeks ago" — the design's relative stamps. */
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relativeTime = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (seconds >= size) {
      return formatter.format(-Math.floor(seconds / size), unit);
    }
  }
  return "just now";
};

const allRows = computed(() =>
  props.flows
    .map((flow) => {
      const fund = fundByKey.value.get(`${flow.chainId}-${flow.fundAddress}`);
      const operation = resolveVaultOperation(flow.name);
      // A flow against a vault the discover feed does not list cannot be
      // named or denominated, so it is left out rather than shown as unknown.
      if (!fund || !operation) return null;

      const isShares = operation.denomination === "shares";
      const token = isShares ? fund.fundToken : fund.baseToken;

      return {
        id: flow.id,
        chainId: flow.chainId,
        key: `${fund.chainId}-${fund.address}`,
        photoUrl: fund.photoUrl,
        symbol: fund.fundToken?.symbol ?? "",
        title: fund.title,
        label: operation.label,
        group: operationGroup(operation),
        dot: operationDot(operation),
        // The settled row borrows the request's amount — see
        // resolveSettledAmounts. Without that a deposit reads as a blank.
        amount:
          flow.resolvedAmount == null
            ? "—"
            : `${formatTokenValue(flow.resolvedAmount, token?.decimals, true, true)} ${token?.symbol ?? ""}`.trim(),
        amountSymbol: token?.symbol ?? "",
        timestamp: flow.timestamp,
        when: relativeTime(flow.timestamp),
        txHash: flow.txHash,
        fund,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.timestamp - a.timestamp),
);

const rows = computed(() => {
  const group = FILTERS.find((f) => f.label === activeFilter.value)?.group;
  if (!group) return allRows.value;
  return allRows.value.filter((row) => row.group === group);
});

const pageCount = computed(() =>
  Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)),
);

const pagedRows = computed(() =>
  rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
);

// A shorter list can leave the pager past the end of it.
watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});

const openVault = (row: { fund: IFund }) => {
  router.push(
    getFundDetailsUrl(
      row.fund.chainId as ChainId,
      row.fund.fundToken.symbol,
      row.fund.address,
    ),
  );
};
</script>

<style lang="scss" scoped>
.activity {
  /* Same chips as the vault's transaction history, minus the Settlement one:
     two lists of the same events should be filtered the same way. */
  &__head_left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  &__filter {
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.3125rem 0.6875rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 12px;
    font-weight: 600;
    color: $color-text-irrelevant;
    white-space: nowrap;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover {
      color: $color-white;
    }

    &--active {
      color: $color-cyan;
      border-color: $color-accent-line;
      background: $color-accent-soft;
    }
  }

  &__filter_dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 999px;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0 0.25rem;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  /* One grid for every row rather than one per row: the amount and timestamp
     tracks size to their content, so a figure with more decimals would widen
     its own row's columns and knock that row out of line with the others. */
  &__rows {
    display: grid;
    grid-template-columns:
      minmax(0, 1.5fr) minmax(160px, 0.9fr)
      minmax(110px, auto) minmax(110px, auto);
    column-gap: 1rem;
    margin-bottom: 0.875rem;
  }

  &__row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 1rem;
    padding: 0.6875rem 0;
    border-top: 1px solid $color-line;
  }

  &__vault {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    cursor: pointer;
  }

  &__vault_name {
    font-size: 13px;
    font-weight: 700;
    color: $color-white;
    transition: color $default-transition-time ease;
    @include ellipsis;

    .activity__vault:hover & {
      color: $color-cyan;
    }
  }

  &__op {
    display: flex;
    align-items: center;
    gap: 0.5625rem;
    min-width: 0;
    font-size: 13px;
    color: $color-text-irrelevant;
    white-space: nowrap;
  }

  &__dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 999px;
  }

  &__amount {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4375rem;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__when {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    white-space: nowrap;

    /* The link wraps the stamp and the arrow together, so both pick up the
       accent on hover and the whole cell reads as one target — the same as the
       vault's own activity table. */
    :deep(.address-link) {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: inherit;
      color: $color-steel-blue;
      transition: color $default-transition-time ease;

      &:hover {
        color: $color-cyan;
        text-decoration: none;
      }
    }
  }
}
</style>
