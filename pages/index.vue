<template>
  <div class="discover">
    <h3 class="main_title">Rethink Finance | Run Funds On-Chain</h3>
    <div v-if="loadingFunds">
      <v-skeleton-loader type="table" />
    </div>
    <div v-else-if="fetchFundsError" class="w-100 d-flex justify-center flex-column">
      <h3>Oops, something went wrong while getting funds data</h3>
      <span>
        Maybe the current RPC (<a :href="web3Store.currentRPC">{{ web3Store.currentRPC }}</a>) is down?
      </span>
    </div>
    <div v-else>
      <Table :data="funds" :columns="columns" :get-cell-class="getCellClass" :showControls="false" />
    </div>
  </div>
</template>

<script setup lang="jsx">
import { useFundsStore } from "~/store/funds.store";
// It is important not to remove the following two imports or they
// will not be visible in the production build.
import PositionTypesBar from "~/components/fund/info/PositionTypesBar";
import FundNameCell from "../components/table/components/FundNameCell";
import { useWeb3Store } from "~/store/web3.store";

const loadingFunds = ref(true);
const funds = computed(() => fundsStore.funds);
const fundsStore = useFundsStore();
const web3Store = useWeb3Store();

const columns = ref([
  {
    accessorKey: "name",
    header: "Fund Name",
    size: 130,
    minSize: 130,
    maxSize: 230,
    enableSorting: false,
    cell: ({ row }) => {
      const fund = row.original;
      return h(<FundNameCell />, {
        image: fund?.photoUrl,
        title: fund?.fundToken?.symbol,
        subtitle: fund?.title,
      });
    },
  },
  {
    accessorKey: "chainIcon",
    header: "Chain",
    size: 62,
    maxWidth: 62,
    cell: (info) => {
      return h(<Icon class="mr-2" width="1.5rem" />, {
        icon: info.getValue(),
      });
    },
  },
  {
    accessorKey: "totalNAVWei",
    header: "AUM",
    cell: ({row}) => {
      const fund = row.original;
      const aum = Number(formatTokenValue(fund.totalNAVWei, fund.baseToken.decimals, false));
      return formatNumberShort(aum) + " " + fund.baseToken.symbol;
    }
  },
  {
    accessorKey: "inceptionDate",
    header: "Inception",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "cumulativeReturnPercent",
    header: "Cumulative",
    size: 100,
    maxSize: 130,
    cell: (info) => formatPercent(info.getValue()),
  },
  {
    accessorKey: "monthlyReturnPercent",
    header: "Monthly",
    maxSize: 100,
    cell: (info) => formatPercent(info.getValue()),
  },
  {
    accessorKey: "sharpeRatio",
    header: "Sharpe Ratio",
    minSize: 115,
    cell: (info) => info.getValue() || "N/A",
  },
  {
    accessorKey: "positionTypeCounts",
    header: "Position Types",
    size: "auto",
    minSize: 128,
    maxSize: 158,
    cell: (info) => {
      return h(PositionTypesBar, {
        "position-type-counts": info.getValue() ?? [],
      });
    },
  },
]);

const fetchFundsError = ref(false);

const fetchFunds = async () => {
  loadingFunds.value = true;
  fetchFundsError.value = false;

  try {
    await fundsStore.fetchFunds();
  } catch (e) {
    console.error("fetchFunds -> ", e);
    fetchFundsError.value = true;
  }
  loadingFunds.value = false;
}
onMounted(async () => fetchFunds());


watch(() => web3Store.chainId, () => {
  fetchFunds();
});

function getCellClass(cell) {
  if (["monthlyReturnPercent", "cumulativeReturnPercent"].includes(cell.column.id)) {
    return numberColorClass(cell.getValue());
  }
  // Uncomment if we want to color Sharpe ratio also.
  // else if ('sharpeRatio' === cell.column.id) {
  //   return numberColorClass(cell.getValue(), 1);
  // }
  return "";
}
</script>

<style lang="scss">
.discover {
  width: 100%;
}
</style>
