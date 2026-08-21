<template>
  <div class="activity brand_card">
    <div class="brand_card__head">
      <div class="activity__head_left">
        <div class="brand_card__eyebrow">
          Transaction history
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
    </div>

    <v-progress-linear v-if="isLoading" indeterminate class="mb-2" />

    <div class="activity__table">
      <div class="activity__row activity__row--head">
        <div class="activity__th">
          Address
        </div>
        <div class="activity__th">
          Operation
        </div>
        <div class="activity__th activity__th--right">
          Amount
        </div>
        <div class="activity__th activity__th--right">
          Timestamp
        </div>
      </div>

      <div v-for="row in pagedRows" :key="row.id" class="activity__row">
        <div class="activity__address">
          <!-- Operations the vault itself performs are signed by a role
               holder, so they read as the role rather than a hex string. -->
          <span v-if="row.roleLabel" class="activity__role">
            <AddressLink
              v-if="row.address"
              :address="row.address"
              :chain-id="fund.chainId"
            >
              {{ row.roleLabel }}
            </AddressLink>
            <template v-else>
              {{ row.roleLabel }}
            </template>
          </span>
          <AddressLink
            v-else-if="row.address"
            :address="row.address"
            :chain-id="fund.chainId"
            truncate
          />
          <template v-else>
            N/A
          </template>
        </div>

        <div class="activity__op">
          <span class="activity__dot" :style="{ background: row.dot }" />
          <span>{{ row.label }}</span>
        </div>

        <div class="activity__amount">
          <span class="activity__amount_value">{{ row.amount }}</span>
          <span v-if="row.amountUsd" class="activity__amount_usd">
            {{ row.amountUsd }}
          </span>
        </div>

        <!-- The stamp is the handle for the transaction, so the whole of it is
             the link rather than just the arrow beside it. -->
        <div class="activity__when">
          <AddressLink
            v-if="row.txHash"
            :address="row.txHash"
            :chain-id="fund.chainId"
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

      <div v-if="!isLoading && !filteredRows.length" class="activity__empty">
        No transactions yet
      </div>
    </div>

    <div v-if="filteredRows.length" class="activity__footer">
      <div class="activity__page_label">
        Page {{ page }} of {{ pageCount }} · {{ PAGE_SIZE }} per page
      </div>
      <div class="activity__pager">
        <button
          type="button"
          class="activity__page_btn"
          :disabled="page === 1"
          @click="page -= 1"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Previous
        </button>
        <div class="activity__page_num">
          {{ page }}
        </div>
        <button
          type="button"
          class="activity__page_btn"
          :disabled="page >= pageCount"
          @click="page += 1"
        >
          Next
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import type IFund from "~/types/fund";
import type { ChainId } from "~/types/enums/chain_id";
import { fetchSubgraphFundFlows, type FundFlow } from "~/services/subgraph";
import {
  fetchSettlementTransactions,
  type SettlementTransactionLookup,
} from "~/services/settlementTransactions";
import {
  fetchExplorerVaultFlows,
  type VaultFlow,
} from "~/services/vaultFlows";
import { formatTokenValue, formatNumberShort } from "~/composables/formatters";
import { useFundStore } from "~/store/fund/fund.store";
import AddressLink from "~/components/common/AddressLink.vue";
import {
  OPERATION_DOT_DEPOSIT,
  OPERATION_DOT_NEUTRAL,
  OPERATION_DOT_REDEEM,
  OPERATION_DOT_SETTLEMENT,
} from "~/composables/vaultOperations";

const props = defineProps<{ fund: IFund }>();

const fundStore = useFundStore();

/**
 * Everything that has happened to the vault, from the two places it is
 * recorded: depositor-driven operations come from the subgraph's fundFlows,
 * and settlements are the vault's NAV updates — the subgraph has no event for
 * them. Both feeds are small (tens of rows per vault), so they are fetched
 * whole, merged, and then filtered and paged in memory. That is also what
 * makes an honest total count and "page x of y" possible.
 */
const PAGE_SIZE = 8;

/* Shared with the portfolio's activity list, so the same event carries the same
   colour on both screens. */
const DOT_DEPOSIT = OPERATION_DOT_DEPOSIT;
const DOT_WITHDRAW = OPERATION_DOT_REDEEM;
const DOT_SETTLEMENT = OPERATION_DOT_SETTLEMENT;

type ActivityKind = "deposit" | "withdraw" | "settlement" | "other";

interface ActivityRow {
  id: string;
  kind: ActivityKind;
  label: string;
  dot: string;
  address?: string;
  roleLabel?: string;
  amount: string;
  amountUsd?: string;
  timestamp: number;
  when: string;
  txHash?: string;
}

const FILTERS: { label: string; kind?: ActivityKind; dot: string }[] = [
  { label: "All", dot: "" },
  { label: "Deposit", kind: "deposit", dot: DOT_DEPOSIT },
  { label: "Withdraw", kind: "withdraw", dot: DOT_WITHDRAW },
  { label: "Settlement", kind: "settlement", dot: DOT_SETTLEMENT },
];

/**
 * The subgraph stores names as full signatures — "requestDeposit(uint256)",
 * not "requestDeposit" — so these match on exactly those strings (verified
 * against the live deployments). Requests count towards their family: a
 * pending deposit is still a deposit from the depositor's point of view.
 */
const OPERATIONS: Record<string, { label: string; kind: ActivityKind }> = {
  "deposit()": { label: "Deposit", kind: "deposit" },
  "requestDeposit(uint256)": { label: "Request Deposit", kind: "deposit" },
  "depositAndDelegateBySig(uint256,address,bytes,uint256,uint8,bytes32,bytes32)":
    { label: "Deposit + Delegate", kind: "deposit" },
  "withdraw()": { label: "Redeem", kind: "withdraw" },
  "requestWithdraw(uint256)": { label: "Request Redeem", kind: "withdraw" },
  "revokeDepositWithrawal(bool)": { label: "Revoke Request", kind: "withdraw" },
  "sweepTokens()": { label: "Sweep Tokens", kind: "other" },
};

const activeFilter = ref("All");
const page = ref(1);
const isLoading = ref(false);
const subgraphFlows = ref<VaultFlow[]>([]);
const explorerFlows = ref<VaultFlow[]>([]);
const settlementTxHashes = ref<SettlementTransactionLookup>({});
// Read here rather than in the lookup: the lookup runs from a watcher, outside
// any Nuxt instance.
const etherscanApiKey = String(useRuntimeConfig().public.ETHERSCAN_KEY ?? "");

const pickFilter = (label: string) => {
  if (activeFilter.value === label) return;
  activeFilter.value = label;
  page.value = 1;
};

/**
 * Flows carry unix seconds; NAV updates come off the reader contract already
 * multiplied to milliseconds. Normalise before doing any date maths.
 */
const toSeconds = (timestamp: number) =>
  timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;

const loadSubgraphFlows = async (fund: IFund) => {
  try {
    const data = await fetchSubgraphFundFlows(fund.chainId as ChainId, {
      fundAddress: fund.address,
      first: 1000,
      skip: 0,
    });
    subgraphFlows.value = data.items.map((flow: FundFlow) => ({
      id: flow.id,
      name: flow.name,
      amount: flow.amount,
      timestamp: toSeconds(parseInt(flow.timestamp, 10) || 0),
      from: flow.txFrom?.id,
      txHash: flow.transaction?.id,
    }));
  } catch (e: any) {
    // Three of the five chains have no working deployment, so this failing is
    // ordinary rather than exceptional — the explorer covers the same ground.
    console.warn("Subgraph fund flows unavailable", e);
    subgraphFlows.value = [];
  }
};

const loadExplorerFlows = async (fund: IFund) => {
  explorerFlows.value = await fetchExplorerVaultFlows(
    fund.chainId as ChainId,
    fund.address,
    etherscanApiKey,
  );
};

/**
 * Both feeds are asked for at once and merged as they land, so neither one
 * being slow or missing holds up the other.
 */
const loadFundFlows = async () => {
  const fund = props.fund;
  if (!fund?.address || !fund?.chainId) return;
  isLoading.value = true;
  try {
    await Promise.all([loadSubgraphFlows(fund), loadExplorerFlows(fund)]);
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.fund?.address,
  () => {
    page.value = 1;
    activeFilter.value = "All";
    settlementTxHashes.value = {};
    subgraphFlows.value = [];
    explorerFlows.value = [];
    loadFundFlows();
  },
  { immediate: true },
);

/**
 * USD per unit of base token. totalSimulatedNavUSD prices the *simulated* NAV,
 * so the denominator has to be that same figure — pairing it with the last NAV
 * update's total (which can be a fraction of it) skews the rate badly.
 */
const usdPerBaseToken = computed(() => {
  const usd = Number(props.fund?.totalSimulatedNavUSD ?? 0);
  const decimals = props.fund?.baseToken?.decimals;
  const nav = fundStore.totalCurrentSimulatedNAV;
  if (!usd || !nav || decimals == null) return 0;
  const navTokens = Number(ethers.formatUnits(nav, decimals));
  return navTokens > 0 ? usd / navTokens : 0;
});

const formatUsd = (tokens: number) => {
  const rate = usdPerBaseToken.value;
  if (!rate || !tokens) return "";
  return `$${formatNumberShort(tokens * rate)}`;
};

/** "9 hours ago", "2 weeks ago" — the design's relative stamps. */
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];
const relativeTime = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return "just now";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
};

/**
 * Resolved separately from the rows and merged in afterwards: it walks the
 * explorer, which is slower and less reliable than either feed, and a
 * settlement is worth showing whether or not its transaction is found.
 */
const navUpdateTimestamps = computed(() =>
  (props.fund?.navUpdates ?? [])
    .map((update) => toSeconds(update.timestamp))
    .filter(Boolean),
);

/**
 * Everything the lookup needs. The vault's contracts and its NAV updates are
 * fetched by different actions and land at different times, so the lookup has
 * to wait on all of them rather than on whichever arrives first.
 */
const settlementLookupInputs = computed(() => ({
  address: props.fund?.address,
  chainId: props.fund?.chainId,
  safeAddress: props.fund?.safeAddress,
  governorAddress: props.fund?.governorAddress,
  navUpdateCount: navUpdateTimestamps.value.length,
}));

const loadSettlementTransactions = async () => {
  const fund = props.fund;
  const timestamps = navUpdateTimestamps.value;
  if (!fund?.address || !fund?.chainId || !timestamps.length) return;

  const lookup = await fetchSettlementTransactions(
    fund.chainId as ChainId,
    fund.address,
    {
      safeAddress: fund.safeAddress,
      governorAddress: fund.governorAddress,
      managerAddresses: Array.from(fund.allowedManagerAddresses ?? []),
      oldestTimestamp: Math.min(...timestamps),
      etherscanApiKey,
    },
  );

  // The vault's addresses arrive in stages, so this can be called more than
  // once and an early call can come back empty after a later one has answered.
  if (props.fund?.address !== fund.address) return;
  if (Object.keys(lookup).length) settlementTxHashes.value = lookup;
};

watch(settlementLookupInputs, () => loadSettlementTransactions(), {
  immediate: true,
});

/**
 * The two feeds overlap wherever both work, so a transaction seen by each has
 * to appear once. The subgraph is written second and wins, since it decoded the
 * call rather than inferring it from calldata.
 */
const mergedFlows = computed<VaultFlow[]>(() => {
  const byTransaction = new Map<string, VaultFlow>();
  for (const flow of [...explorerFlows.value, ...subgraphFlows.value]) {
    if (!flow.txHash) continue;
    byTransaction.set(`${flow.txHash.toLowerCase()}:${flow.name}`, flow);
  }
  return [...byTransaction.values()];
});

const flowRows = computed<ActivityRow[]>(() =>
  mergedFlows.value.map((flow) => {
    const operation = OPERATIONS[flow.name];
    const kind = operation?.kind ?? "other";
    // Deposits move base asset, redemptions move vault shares.
    const token =
      kind === "withdraw" ? props.fund?.fundToken : props.fund?.baseToken;

    let amount = "-";
    let amountUsd = "";
    if (flow.amount && token?.decimals != null) {
      const raw = BigInt(flow.amount);
      amount = `${formatTokenValue(raw, token.decimals, true, true)} ${token.symbol ?? ""}`.trim();
      if (kind === "deposit") {
        amountUsd = formatUsd(Number(ethers.formatUnits(raw, token.decimals)));
      }
    }

    return {
      id: `flow-${flow.id}`,
      kind,
      label: operation?.label ?? flow.name,
      dot:
        kind === "deposit"
          ? DOT_DEPOSIT
          : kind === "withdraw"
            ? DOT_WITHDRAW
            : OPERATION_DOT_NEUTRAL,
      address: flow.from,
      amount,
      amountUsd,
      timestamp: flow.timestamp,
      when: relativeTime(flow.timestamp),
      txHash: flow.txHash,
    };
  }),
);

/**
 * A NAV update is the vault settling its cycle: it revalues every position and
 * clears the pending deposits and redemptions. It is signed by a role holder,
 * which is why the address column reads "Curator" here.
 */
const settlementRows = computed<ActivityRow[]>(() => {
  const decimals = props.fund?.baseToken?.decimals;
  const symbol = props.fund?.baseToken?.symbol ?? "";
  const curator = props.fund?.allowedManagerAddresses?.[0];

  return (props.fund?.navUpdates ?? [])
    .filter((update) => update.timestamp)
    .map((update) => {
      const total = update.totalNAV ?? 0n;
      const tokens =
        decimals == null ? 0 : Number(ethers.formatUnits(total, decimals));
      const timestamp = toSeconds(update.timestamp);
      return {
        id: `nav-${update.index}`,
        kind: "settlement" as const,
        label: "Settlement",
        dot: DOT_SETTLEMENT,
        address: curator,
        roleLabel: "Curator",
        amount:
          decimals == null
            ? "-"
            : `${formatTokenValue(total, decimals, true, true)} ${symbol}`.trim(),
        amountUsd: formatUsd(tokens),
        timestamp,
        when: relativeTime(timestamp),
        txHash: settlementTxHashes.value[timestamp],
      };
    });
});

const allRows = computed(() =>
  [...flowRows.value, ...settlementRows.value].sort(
    (a, b) => b.timestamp - a.timestamp,
  ),
);

const filteredRows = computed(() => {
  const kind = FILTERS.find((f) => f.label === activeFilter.value)?.kind;
  if (!kind) return allRows.value;
  return allRows.value.filter((row) => row.kind === kind);
});

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)),
);

const pagedRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filteredRows.value.slice(start, start + PAGE_SIZE);
});

// Filtering down can leave the pager past the end of the new list.
watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});
</script>

<style scoped lang="scss">
/**
 * Transaction history, laid out as the design's four-column grid rather than a
 * <table>: the columns need to hold their proportions while the address cell
 * truncates, which a grid does without any column-width juggling.
 */
$activity-columns: $details-table-columns;

/**
 * Only some rows carry a USD sub-line under the amount, which would otherwise
 * make them taller than their neighbours. Every row reserves the height of that
 * two-line cell so the list keeps one rhythm, whatever each row happens to hold.
 *
 * The reserve is derived from the very tokens the amount cell is built from
 * rather than eyeballed, so changing a font size can't quietly leave the rows
 * uneven again. Both sizes are px, so the sum holds whatever the root font is.
 */
$activity-amount-size: 12.5px;
$activity-amount-usd-size: 11px;
$activity-amount-line-height: 1.35;
$activity-amount-gap: 0.1875rem;
$activity-row-padding: 0.9375rem;
$activity-row-border: 1px;

$activity-cell-height: calc(
  #{$activity-amount-size * $activity-amount-line-height} +
  #{$activity-amount-usd-size * $activity-amount-line-height} +
  #{$activity-amount-gap}
);

.activity {
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

  /* One grid for the whole table, not one per row. The amount and timestamp
     tracks size to their content, so a figure carrying more decimals widens
     its own column — and while each row measured itself, that pushed only that
     row's operation cell out of line with the rest. As a subgrid every row and
     the header resolve against the same tracks, so the widest amount sets the
     column for all of them. */
  &__table {
    display: grid;
    grid-template-columns: $activity-columns;
    column-gap: $details-table-gap;
  }

  &__row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 1rem;
    min-height: calc(
      #{$activity-cell-height} + 2 * #{$activity-row-padding} +
      #{$activity-row-border}
    );
    padding: $activity-row-padding 0;
    border-top: $activity-row-border solid $color-line;

    &--head {
      min-height: 0;
      padding: 0 0 0.625rem;
      border-top: 0;
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

  &__address {
    min-width: 0;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-text-irrelevant;
    @include ellipsis;

    :deep(.address-link) {
      font-size: inherit;
      color: $color-text-irrelevant;
      transition: color $default-transition-time ease;

      &:hover {
        color: $color-cyan;
        text-decoration: none;
      }
    }
  }

  /* A named role carries the accent so it reads as a party rather than a
     truncated hash. */
  &__role {
    font-family: $font-sans;
    font-size: 13px;
    color: $color-cyan;

    :deep(.address-link) {
      font-family: inherit;
      font-size: inherit;
      color: $color-cyan;
    }
  }

  &__op {
    display: flex;
    align-items: center;
    gap: 0.5625rem;
    min-width: 0;
    font-size: 13px;
    color: $color-white;
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
    flex-direction: column;
    align-items: flex-end;
    gap: $activity-amount-gap;
    font-family: $font-mono;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Pinned line heights: the row reserves space for both of these, so the
     figure has to be known rather than left to the font's default. */
  &__amount_value {
    font-size: $activity-amount-size;
    line-height: $activity-amount-line-height;
    color: $color-white;
  }

  &__amount_usd {
    font-size: $activity-amount-usd-size;
    line-height: $activity-amount-line-height;
    color: $color-steel-blue;
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
       accent on hover and the whole cell reads as one target. */
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

  &__empty {
    /* A child of the table grid now, so it has to be told to span it. */
    grid-column: 1 / -1;
    padding: 1.5rem 0;
    border-top: 1px solid $color-line;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid $color-line;
  }

  &__page_label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__pager {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__page_btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.4375rem 0.8125rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 12.5px;
    font-weight: 600;
    color: $color-white;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover:not(:disabled) {
      border-color: $color-line-3;
    }

    &:disabled {
      color: $color-inactive;
      cursor: default;
    }
  }

  &__page_num {
    padding: 0.4375rem 0.8125rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
  }
}
</style>
