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
        :is-loading="isLoadingPositions"
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
 * Two loads rather than one. Positions come first, because a vault row is worth
 * showing the moment its balance is known; what each vault is waiting on —
 * votes and pending requests — arrives behind it and tints the rows it
 * concerns. Neither holds up the other.
 */
const accountStore = useAccountStore();
const fundsStore = useFundsStore();

// Read here rather than in the loader: that runs from a watcher, outside any
// Nuxt instance.
const etherscanApiKey = String(useRuntimeConfig().public.ETHERSCAN_KEY ?? "");

const { isConnected, activeAccountAddress } = storeToRefs(accountStore);

const isLoadingPositions = ref(true);
// Shallow: these hold bigints and the funds store's own reactive objects, and
// deep-wrapping them again would cost more than it buys.
const rawPositions = shallowRef<PortfolioPosition[]>([]);
const flows = shallowRef<PortfolioFlow[]>([]);
const attention = ref<Record<string, PositionAttention>>({});

const allFunds = computed<IFund[]>(() => fundsStore.funds);

/**
 * A vault's USD quote arrives with its metadata, which lands after its balance
 * does. Deriving the dollar figures here rather than at load time means they
 * fill in as that metadata catches up, instead of freezing at whatever was
 * known the moment the balance came back.
 */
const positions = computed<PricedPosition[]>(() =>
  rawPositions.value
    .map((position) => ({
      ...position,
      valueUSD: positionValueUSD(position),
      valueSeries: positionValueSeries(position),
    }))
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
 * with a measurable cost carry one — so the total and its cost are taken from
 * the same set, or the profit figure would be a subtraction between two
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
  rawPositions.value = [];
  flows.value = [];
  attention.value = {};

  try {
    const result = await loadPortfolioPositions(account, etherscanApiKey);
    rawPositions.value = result.positions;
    flows.value = result.flows;
  } catch (error) {
    console.error("Failed loading portfolio positions", error);
  } finally {
    isLoadingPositions.value = false;
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
