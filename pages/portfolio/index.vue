<template>
  <div class="portfolio page_shell">
    <h1 class="portfolio__title">
      Portfolio
    </h1>

    <div v-if="!isConnected" class="portfolio__connect brand_card">
      Connect your wallet to see your positions across Rethink vaults.
    </div>

    <template v-else>
      <PortfolioPerformance
        :series="series"
        :return-series="returnSeries"
        :total="totalUSD"
        :is-loading="isLoadingPositions"
        :position-count="positions.length"
        :pending-count="pendingCount"
        :vote-count="voteCount"
        :net-invested="netInvestedUSD"
      />

      <PortfolioPositions
        :positions="positions"
        :attention="attention"
        :is-loading="isLoadingPositions"
      />

      <PortfolioActivity
        :flows="flows"
        :funds="allFunds"
        :is-loading="isLoadingFlows"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAccountStore } from "~/store/account/account.store";
import { useFundsStore } from "~/store/funds/funds.store";
import type IFund from "~/types/fund";
import {
  loadPortfolioPositions,
  positionValueSeries,
  positionValueUSD,
  type PortfolioFlow,
  type PortfolioPosition,
  type PricedPosition,
} from "~/composables/portfolioPositions";
import {
  loadPositionAttention,
  type PositionAttention,
} from "~/composables/portfolioAttention";
import {
  buildWeightedReturnSeries,
  sumValueSeries,
  type ValuePoint,
} from "~/composables/portfolioSeries";

/**
 * The depositor's home, answering three questions in the order they matter:
 * what needs me, how am I doing, what did I do.
 *
 * Loaded in the order things become known, because none of it should wait for
 * the slowest feed. Balances land first — one reader call per vault — and the
 * rows show at once, worth known, cost still blank. The flows arrive behind
 * them (explorer walks are the slow feed) and fill in cost, return and the
 * activity card. Attention items — votes and pending requests — come last and
 * tint the rows they concern.
 */
const accountStore = useAccountStore();
const fundsStore = useFundsStore();

// Read here rather than in the loader: that runs from a watcher, outside any
// Nuxt instance.
const etherscanApiKey = String(useRuntimeConfig().public.ETHERSCAN_KEY ?? "");

const { isConnected, activeAccountAddress } = storeToRefs(accountStore);

const isLoadingPositions = ref(true);
// The activity card reads the flows, which outlive the balance scan by
// seconds; it keeps its own flag so the rows don't wait on it.
const isLoadingFlows = ref(true);
// Shallow: these hold bigints and the funds store's own reactive objects, and
// deep-wrapping them again would cost more than it buys.
const rawPositions = shallowRef<PortfolioPosition[]>([]);
const flows = shallowRef<PortfolioFlow[]>([]);
const attention = ref<Record<string, PositionAttention>>({});

const allFunds = computed<IFund[]>(() => fundsStore.funds);

/**
 * A vault's USD quote arrives with its metadata, which lands after its balance
 * does — and the store replaces its fund objects outright when it does. So
 * each position is re-pointed at the store's current object here, and the
 * dollar figures are derived from that: they fill in as the metadata catches
 * up, instead of freezing at whatever the scan happened to capture.
 */
const positions = computed<PricedPosition[]>(() =>
  rawPositions.value
    .map((position) => {
      const fund =
        fundsStore.chainFunds[position.fund.chainId]?.find(
          (candidate) => candidate.address === position.fund.address,
        ) ?? position.fund;
      const live = { ...position, fund };
      return {
        ...live,
        valueUSD: positionValueUSD(live),
        valueSeries: positionValueSeries(live),
      };
    })
    .sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0)),
);

const series = computed<ValuePoint[]>(() =>
  sumValueSeries(positions.value.map((position) => position.valueSeries)),
);

/**
 * What was earned, as opposed to what is held. Measured from price movement
 * weighted by holdings rather than from the total value, which also moves when
 * money is paid in or a vault first appears in the series.
 */
const returnSeries = computed<ValuePoint[]>(() =>
  buildWeightedReturnSeries(
    positions.value.map((position) => ({
      values: position.valueSeries,
      prices: position.prices,
    })),
  ),
);

const totalUSD = computed(() =>
  positions.value.reduce((sum, position) => sum + (position.valueUSD ?? 0), 0),
);

/**
 * Only positions that can be priced in dollars can be added up, and only those
 * with a knowable cash cost carry one — so the total and its cost are taken
 * from the same set, or the profit figure would be a subtraction between two
 * different portfolios.
 */
const netInvestedUSD = computed(() => {
  let total = 0;
  for (const position of positions.value) {
    if (!position.netInvested || !position.valueUSD) return undefined;
    total += position.netInvested * (position.valueUSD / position.value);
  }
  return total || undefined;
});

const pendingCount = computed(() =>
  Object.values(attention.value).reduce(
    (count, entry) => count + entry.requests.length,
    0,
  ),
);

const voteCount = computed(() =>
  Object.values(attention.value).reduce(
    (count, entry) => count + entry.votes.length,
    0,
  ),
);

const load = async (account: string) => {
  isLoadingPositions.value = true;
  isLoadingFlows.value = true;
  rawPositions.value = [];
  flows.value = [];
  attention.value = {};

  try {
    const result = await loadPortfolioPositions(
      account,
      etherscanApiKey,
      // Balances stream in as vaults answer; show rows the moment the first
      // one exists, cost and return still blank. "No positions" has to wait
      // for the whole scan — it is only true once every vault has said so.
      (balances, scanDone) => {
        rawPositions.value = balances;
        if (balances.length || scanDone) isLoadingPositions.value = false;
      },
      (loadedFlows) => {
        flows.value = loadedFlows;
        isLoadingFlows.value = false;
      },
    );
    rawPositions.value = result.positions;
    flows.value = result.flows;
  } catch (error) {
    console.error("Failed loading portfolio positions", error);
  } finally {
    isLoadingPositions.value = false;
    isLoadingFlows.value = false;
  }

  try {
    attention.value = await loadPositionAttention(rawPositions.value, account);
  } catch (error) {
    console.error("Failed loading portfolio attention items", error);
  }
};

watch(
  activeAccountAddress,
  (account) => {
    if (account) load(account);
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.portfolio {
  display: flex;
  flex-direction: column;
  gap: 1.625rem;

  &__title {
    // Sits where Discover's "On-chain vaults" sits: that page's head carries a
    // 1rem top margin, and its title rides 4px lower still for being bottom
    // aligned against the taller TVL banner beside it.
    margin: calc(1rem + 4px) 0 0;
    font-size: 44px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    color: $color-white;
  }

  &__connect {
    display: flex;
    justify-content: center;
    padding: 3rem;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}
</style>
