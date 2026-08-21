<template>
  <div class="queue brand_card">
    <div class="queue__inner">
      <div class="queue__head">
        <div class="queue__title">
          Request queue
        </div>
        <div class="queue__head_right">
          <div class="queue__filters">
            <button
              v-for="filter in FILTERS"
              :key="filter.label"
              type="button"
              class="queue__filter"
              :class="{ 'queue__filter--active': activeFilter === filter.label }"
              @click="pickFilter(filter.label)"
            >
              <span
                v-if="filter.dot"
                class="queue__filter_dot"
                :style="{ background: filter.dot }"
              />
              {{ filter.label }}
            </button>
          </div>
          <div
            class="queue__summary"
            :class="{
              'queue__summary--unfunded': unfundedCount > 0 && !isFundingUnknown,
              'queue__summary--unknown': isFundingUnknown,
            }"
          >
            {{ summaryText }}
          </div>
        </div>
      </div>

      <v-progress-linear v-if="isLoading" indeterminate />

      <template v-if="filteredRows.length">
        <div class="queue__row queue__row--head">
          <div class="queue__th">
            Depositor
          </div>
          <div class="queue__th">
            Type
          </div>
          <div class="queue__th queue__th--right">
            Amount
          </div>
          <div class="queue__th queue__th--right">
            Base value
          </div>
          <div class="queue__th queue__th--right">
            Requested
          </div>
          <div class="queue__th queue__th--right">
            State
          </div>
        </div>

        <div v-for="row in filteredRows" :key="row.id" class="queue__row">
          <div class="queue__depositor">
            <AddressLink
              :address="row.depositor"
              :chain-id="fund.chainId"
              truncate
            />
          </div>

          <div class="queue__type">
            <span class="queue__dot" :style="{ background: row.dot }" />
            <span>{{ row.type }}</span>
          </div>

          <div class="queue__amount">
            {{ row.amount }}
          </div>

          <div class="queue__base_value">
            {{ row.baseValue }}
          </div>

          <div class="queue__when">
            {{ row.requested }}
          </div>

          <div class="queue__state" :class="`queue__state--${row.state}`">
            <span class="queue__dot queue__dot--state" />
            {{ STATE_LABELS[row.state] }}
          </div>
        </div>
      </template>

      <div v-if="!isLoading && !filteredRows.length" class="queue__empty">
        <!-- Three different silences, and only one of them means the queue is
             clear. Saying "everything settled" when no feed answered is the
             reading a curator would act on by skipping a settlement. -->
        <template v-if="loadFailed || !hasHistory">
          <span class="queue__empty_warn">
            Could not read this vault's request history.
          </span>
          The subgraph and the block explorer both returned nothing, so the
          queue is unknown rather than empty. The totals above are read on
          chain and are unaffected.
        </template>
        <template v-else-if="!rows.length">
          No open requests. The last cycle settled everything in the queue.
        </template>
        <template v-else>
          No {{ activeFilter.toLowerCase() }} entries in the queue.
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers, FixedNumber } from "ethers";
import AddressLink from "~/components/common/AddressLink.vue";
import { commify, formatDate, formatTokenValue, roundToSignificantDecimals } from "~/composables/formatters";
import {
  OPERATION_DOT_DEPOSIT,
  OPERATION_DOT_REDEEM,
  type OpenRequest,
} from "~/composables/vaultOperations";
import { fetchOpenRequests } from "~/services/requestQueue";
import { useFundStore } from "~/store/fund/fund.store";
import type { ChainId } from "~/types/enums/chain_id";
import type IFund from "~/types/fund";

/**
 * Every depositor's outstanding request, replayed from the vault's flow
 * history (see services/requestQueue), and read the way the curator needs it:
 * which requests the coming settlement will value, which are already past one
 * and only wait to be claimed, and which redemptions the admin contract could
 * not pay out today.
 */
const props = defineProps<{
  fund: IFund;
  /** Share → base rate at the page's simulated NAV (manual edit included). */
  exchangeRate?: FixedNumber;
}>();

const fundStore = useFundStore();

type QueueState = "unfunded" | "ready" | "awaiting";

const STATE_LABELS: Record<QueueState, string> = {
  unfunded: "Unfunded",
  ready: "Ready to settle",
  awaiting: "Awaiting cycle",
};

const FILTERS: { label: string; dot?: string }[] = [
  { label: "All" },
  { label: "Deposit", dot: OPERATION_DOT_DEPOSIT },
  { label: "Deposit request", dot: OPERATION_DOT_DEPOSIT },
  { label: "Redemption", dot: OPERATION_DOT_REDEEM },
  { label: "Redemption request", dot: OPERATION_DOT_REDEEM },
];

const activeFilter = ref("All");
const isLoading = ref(false);
const openRequests = ref<OpenRequest[]>([]);
/**
 * Whether the replay had any history to run on. Both feeds report failure as
 * an empty list, so an empty queue built from no flows says nothing about the
 * vault — and "no open requests" is too strong a claim to make from it.
 */
const hasHistory = ref(false);
const loadFailed = ref(false);
// Read here rather than in the loader: it runs from a watcher, outside any
// Nuxt instance.
const etherscanApiKey = String(useRuntimeConfig().public.ETHERSCAN_KEY ?? "");

const pickFilter = (label: string) => {
  activeFilter.value = label;
};

const loadOpenRequests = async () => {
  const fund = props.fund;
  if (!fund?.address || !fund?.chainId) return;
  isLoading.value = true;
  loadFailed.value = false;
  try {
    const { requests, flowCount } = await fetchOpenRequests(
      fund.chainId as ChainId,
      fund.address,
      etherscanApiKey,
    );
    // The vault can change under a slow answer.
    if (props.fund?.address === fund.address) {
      openRequests.value = requests;
      hasHistory.value = flowCount > 0;
    }
  } catch (error) {
    console.error("Failed to reconstruct the request queue", error);
    if (props.fund?.address === fund.address) {
      openRequests.value = [];
      hasHistory.value = false;
      loadFailed.value = true;
    }
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.fund?.address,
  () => {
    activeFilter.value = "All";
    openRequests.value = [];
    hasHistory.value = false;
    loadFailed.value = false;
    loadOpenRequests();
  },
  { immediate: true },
);

/** Flows carry unix seconds; NAV updates arrive in milliseconds. */
const toSeconds = (timestamp: number) =>
  timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;

const lastSettlementSeconds = computed(() => {
  const timestamp = fundStore.fundLastNAVUpdate?.timestamp;
  return timestamp ? toSeconds(timestamp) : undefined;
});

/**
 * A request made before the last settlement has been valued by it — the
 * depositor can claim it directly, so it reads as the operation itself.
 * A request the vault has not settled over yet still awaits its cycle.
 * (A vault with no settlement at all lets requests process immediately —
 * same reading as the deposit card's wait-for-settlement gate.)
 */
const hasSeenSettlement = (request: OpenRequest) => {
  const settled = lastSettlementSeconds.value;
  return settled === undefined || request.timestamp < settled;
};

interface QueueRow {
  id: string;
  depositor: string;
  kind: OpenRequest["kind"];
  type: string;
  dot: string;
  amount: string;
  baseValue: string;
  /** For the funding walk, in base units. */
  baseValueNumber: FixedNumber | undefined;
  requested: string;
  timestamp: number;
  state: QueueState;
}

const rows = computed<QueueRow[]>(() => {
  const baseToken = props.fund?.baseToken;
  const fundToken = props.fund?.fundToken;
  if (!baseToken || !fundToken) return [];

  const queue: QueueRow[] = openRequests.value.map((request) => {
    const isDeposit = request.kind === "deposit";
    const token = isDeposit ? baseToken : fundToken;
    const seen = hasSeenSettlement(request);

    // Deposits are already denominated in base; redemptions convert at the
    // page's simulated-NAV rate.
    let baseValueNumber: FixedNumber | undefined;
    try {
      const amountFN = FixedNumber.fromString(
        ethers.formatUnits(request.amount, token.decimals),
      );
      baseValueNumber = isDeposit
        ? amountFN
        : props.exchangeRate
          ? amountFN.mul(props.exchangeRate)
          : undefined;
    } catch {
      baseValueNumber = undefined;
    }

    return {
      id: `${request.depositor}:${request.kind}`,
      depositor: request.depositor,
      kind: request.kind,
      type: isDeposit
        ? seen ? "Deposit" : "Deposit request"
        : seen ? "Redemption" : "Redemption request",
      dot: isDeposit ? OPERATION_DOT_DEPOSIT : OPERATION_DOT_REDEEM,
      amount: `${formatTokenValue(request.amount, token.decimals, true, true)} ${token.symbol}`,
      baseValue: baseValueNumber
        ? `≈ ${commify(roundToSignificantDecimals(baseValueNumber.toString()))} ${baseToken.symbol}`
        : "≈ –",
      baseValueNumber,
      requested: formatDate(new Date(request.timestamp * 1000)),
      timestamp: request.timestamp,
      state: seen ? "ready" : "awaiting",
    };
  });

  // A queue reads oldest first — that is also the order redemptions draw on
  // the admin contract's liquidity.
  queue.sort((a, b) => a.timestamp - b.timestamp);

  // Walk the redemptions oldest-first, subtracting each covered amount from
  // the admin balance; whatever it cannot cover is unfunded.
  let remaining: FixedNumber | undefined;
  try {
    remaining = FixedNumber.fromString(
      ethers.formatUnits(
        props.fund?.fundContractBaseTokenBalance ?? 0n,
        baseToken.decimals,
      ),
    );
  } catch {
    remaining = undefined;
  }
  if (remaining !== undefined) {
    for (const row of queue) {
      if (row.kind !== "redemption" || !row.baseValueNumber) continue;
      if (remaining.gte(row.baseValueNumber)) {
        remaining = remaining.sub(row.baseValueNumber);
      } else {
        row.state = "unfunded";
      }
    }
  }

  return queue;
});

const unfundedCount = computed(
  () => rows.value.filter((row) => row.state === "unfunded").length,
);

/**
 * A redemption with no base value could not be weighed against the admin
 * contract's balance, so the funding walk skipped it. Reporting "0 unfunded"
 * off the back of that is a claim the page has not checked — and it is exactly
 * the vaults with no share price (nothing minted yet) where it would be made.
 */
const isFundingUnknown = computed(() =>
  rows.value.some(
    (row) => row.kind === "redemption" && !row.baseValueNumber,
  ),
);

const summaryText = computed(() => {
  const count = rows.value.length;
  let summary = `${count} ${count === 1 ? "request" : "requests"}`;
  if (isFundingUnknown.value) summary += " · funding unknown";
  else if (unfundedCount.value) summary += ` · ${unfundedCount.value} unfunded`;
  return summary;
});

const filteredRows = computed(() => {
  if (activeFilter.value === "All") return rows.value;
  return rows.value.filter((row) => row.type === activeFilter.value);
});
</script>

<style scoped lang="scss">
/**
 * The design's queue table: a padding-less card scrolling sideways around an
 * 860px table, every row the same fixed six-track grid so the columns hold
 * without a subgrid.
 */
$queue-columns: 1.1fr 160px 1fr 1fr 110px 170px;

.queue {
  padding: 0;
  overflow-x: auto;

  &__inner {
    min-width: 860px;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 20px 24px 16px;
  }

  &__title {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__head_right {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__filter {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 11px;
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
      background: $color-cyan-tint;
    }
  }

  &__filter_dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 999px;
  }

  &__summary {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;

    &--unfunded {
      color: $color-neg;
    }

    /* Not a shortfall — a reading the page could not take. Warned, not alarmed. */
    &--unknown {
      color: $color-warning;
    }
  }

  &__row {
    display: grid;
    grid-template-columns: $queue-columns;
    align-items: center;
    column-gap: 1rem;
    padding: 12px 24px;
    border-bottom: 1px solid $color-line;

    &--head {
      height: 38px;
      padding: 0 24px;
    }

    &:last-child {
      border-bottom: 0;
    }
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    white-space: nowrap;

    &--right {
      text-align: right;
    }
  }

  &__depositor {
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

  /* Plain regular-weight label after its family dot — the dot carries the
     colour, the words stay quiet. */
  &__type {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    font-size: 13px;
    color: $color-white;
    white-space: nowrap;
  }

  &__dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 999px;

    &--state {
      background: currentColor;
    }
  }

  &__amount {
    font-family: $font-mono;
    font-size: 13px;
    color: $color-white;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__base_value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-steel-blue;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__when {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-steel-blue;
    text-align: right;
    white-space: nowrap;
  }

  &__state {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;

    &--ready {
      color: $color-text-irrelevant;
    }

    &--awaiting {
      color: $color-steel-blue;
    }

    &--unfunded {
      color: $color-neg;
    }
  }

  &__empty {
    padding: 4px 24px 26px;
    font-size: 13.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  /* Leads the sentence, so the state is read before its explanation. */
  &__empty_warn {
    display: block;
    color: $color-warning;
  }
}
</style>
