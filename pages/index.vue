<template>
  <div class="discover">
    <v-toolbar
      flat
      color="transparent"
      style="width: 100%; padding-inline: 200px"
      class="mt-10 mb-4"
    >
      <h3 style="color: #205fff">Rethink Fund DAOs</h3>
    </v-toolbar>
    <Table :data="funds" :columns="columns" :get-cell-class="getCellClass" :showControls="false" />
  </div>
</template>

<script setup lang="jsx">
import { ref, h } from "vue";
import FundNameCell from "../components/table/components/FundNameCell";
import {useFundStore} from "~/store/modules/fund.store";

const columns = ref([
  {
    accessorKey: "name",
    header: "Fund Name",
    size: 250,
    minSize: 250,
    maxSize: 300,
    cell: (info) => {
      const fund = info.row.original;

      return h(<FundNameCell />, {
        image: fund?.avatar_url,
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
      return h(<Icon class="mr-2" size="1.5rem" color="white"/>, {
        name: chainIconName(info.getValue()),
      });
    },
  },
  {
    accessorKey: "aum_value",
    header: "AUM",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "inception_date",
    header: "Inception",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "cumulative_return_percent",
    header: "Cumulative",
    size: 100,
    cell: (info) => formatPercent(info.getValue()),
  },
  {
    accessorKey: "monthly_return_percent",
    header: "Monthly",
    cell: (info) => formatPercent(info.getValue()),
  },
  {
    accessorKey: "sharpe_ratio",
    header: "Sharpe Ratio",
    minSize: 100,
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "position_types",
    header: "Position Types",
    size: "auto",
    minSize: 128,
    maxSize: 158,
    cell: (info) => {
      return h(<FundInfoPositionTypesBar />, {
        'position-types': info.getValue(),
      });
    },
  },
]);

function getCellClass(cell) {
  if (["monthly_return_percent", "cumulative_return_percent"].includes(cell.column.id)) {
    return numberColorClass(cell.getValue());
  } else if ('sharpe_ratio' === cell.column.id) {
    return numberColorClass(cell.getValue(), 1);
  }
  return '';
}

const fundStore = useFundStore();
const funds = computed(() => fundStore.funds);
</script>
