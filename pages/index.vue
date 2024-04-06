<template>
  <div class="discover">
    <h3 class="main_title">Rethink Fund DAOs</h3>
    <div v-if="loadingFunds">
      Loading...
    </div>
    <div v-else="loading">
      <Table :data="funds" :columns="columns" :get-cell-class="getCellClass" :showControls="false" />
    </div>
  </div>
</template>

<script setup lang="jsx">
import { h, ref } from "vue";
import { useFundStore } from "~/store/fund.store";
// It is important not to remove the following two imports or they
// will not be visible in the production build.
import PositionTypesBar from "~/components/fund/info/PositionTypesBar";
import FundNameCell from "../components/table/components/FundNameCell";

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
        image: fund?.avatarUrl,
        title: fund?.title,
        subtitle: fund?.subtitle,
      });
    },
  },
  {
    accessorKey: "chain",
    header: "Chain",
    size: 62,
    maxWidth: 62,
    cell: (info) => {
      return h(<Icon class="mr-2" size="1.5rem" color="white" />, {
        name: chainIconName(info.getValue()),
      });
    },
  },
  {
    accessorKey: "aumValue",
    header: "AUM",
    cell: (info) => formatUSDValue(info.getValue()),
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
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "positionTypes",
    header: "Position Types",
    size: "auto",
    minSize: 128,
    maxSize: 158,
    cell: (info) => {
      return h(<PositionTypesBar />, {
        "position-types": info.getValue(),
      });
    },
  },
]);


const loadingFunds = ref(true);
const funds = computed(() => fundStore.funds);
const fundStore = useFundStore();

onMounted(async () => {
  loadingFunds.value = true;
  try {
    await fundStore.fetchFunds();
  } catch (e) {
    console.error("fetchFunds -> ", e);
   }
  loadingFunds.value = false;
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

// const fundStore = useFundStore();
// const funds = computed(() => fundStore.funds);
</script>

<style lang="scss">
.discover {
  width: 100%;
}
</style>
