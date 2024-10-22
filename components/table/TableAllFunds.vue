<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_all_funds"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading Funds"
    items-per-page="-1"
    @click:row="navigateFundDetails"
  >
    <template #item.name="{ item }">
      <FundNameCell
        :image="item.photoUrl"
        :title="item.fundToken.symbol"
        :subtitle="item.title"
      />
    </template>

    <template #item.chainShort="{ item }">
      <Icon
        :icon="icon(item.chainShort).name"
        :width="icon(item.chainShort).size"
        class="mr-2"
      />
    </template>

    <template #item.lastNAVUpdateTotalNAV="{ item }">
      <div :class="{'justify-center': item.isNavUpdatesLoading}">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else>
          {{ formatNumberShort(formatTokenValue(item.lastNAVUpdateTotalNAV, item.baseToken.decimals, false))
            + " " + item.baseToken.symbol
          }}
        </template>
      </div>
    </template>

    <!-- cumulative -->
    <template #item.cumulativeReturnPercent="{ item }">
      <div :class="{'justify-center': item.isNavUpdatesLoading}">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <div v-else :class="numberColorClass(item.cumulativeReturnPercent)">
          {{ formatPercent(item.cumulativeReturnPercent, true) }}
        </div>
      </div>
    </template>

    <template #item.positionTypeCounts="{ item }">
      <PositionTypesBar :position-type-counts="item.positionTypeCounts ?? []" />
    </template>

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>

  <div v-else-if="items.length === 0 && !loading" class="nav_entries__no_data">
    No Funds available.
  </div>
</template>

<script lang="ts" setup>
import { Icon } from "@iconify/vue/dist/iconify.js";
import PositionTypesBar from "../fund/info/PositionTypesBar.vue";
import FundNameCell from "./components/FundNameCell.vue";
import { formatNumberShort, formatPercent, formatTokenValue } from "~/composables/formatters";
import { numberColorClass } from "~/composables/numberColorClass.js";
import { useWeb3Store } from "~/store/web3.store";
import type IFund from "~/types/fund";

const web3Store = useWeb3Store();
const router = useRouter();

const props = defineProps({
  items: {
    type: Array as () => IFund[],
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const headers: any = computed(() => {
  const headers = [
    {
      title: "Fund Name",
      key: "name",
      sortable: false,
      width: 200,
      maxWidth: 300,
      minWidth: 200,
    },
    {
      title: "Chain",
      key: "chainShort",
      width: 62,
      maxWidth: 62,
      align: "end",
    },
    {
      title: "AUM",
      key: "totalNAVWei",
      align: "end",
    },
    {
      title: "Inception",
      key: "inceptionDate",
      value: (v: IFund) => v.inceptionDate,
      align: "end",
    },
    {
      title: "Cumulative",
      key: "cumulativeReturnPercent",
      maxWidth: 100,
      value: (v: IFund) => formatPercent(v.cumulativeReturnPercent, true),
      align: "end",
    },
    {
      title: "Monthly",
      key: "monthlyReturnPercent",
      maxWidth: 100,
      value: (v: IFund) => formatPercent(v.monthlyReturnPercent, true),
      align: "end",
    },
    {
      title: "Sharpe Ratio",
      key: "sharpeRatio",
      maxWidth: 100,
      value: (v: IFund) => v.sharpeRatio || "N/A",
      align: "end",
    },
    {
      title: "Position Types",
      key: "positionTypeCounts",
      width: 128,
      maxWidth: 158,
      align: "end",
    },
  ];

  return headers;
});

const icon = (chainShort: string) => {
  const icon = getChainIcon(chainShort);
  return {
    name: icon.name,
    size: icon.size,
  };
};

const navigateFundDetails = (event: any, row: any) => {
  const chainId = web3Store.chainId;
  router.push(
    `/details/${chainId}-${row.item.fundToken.symbol}-${row.item.address}`,
  );
};
</script>

<style lang="scss" scoped>
.table_all_funds {
  @include borderGray;
  border-color: $color-bg-transparent;
  // add table max height
  :deep(.v-table__wrapper) {
    max-height: 500px;
    @include customScrollbar;

    .v-data-table__tr {
      height: 72px;
      cursor: pointer;
      transition:
        background-color 0.3s ease,
        box-shadow 0.3s ease;
      color: $color-steel-blue;
      outline: 2px solid #111c35;
      background-color: $color-table-row;
      color: white;

      &:hover {
        background-color: $color-gray-transparent;
        box-shadow: 0px 0px 10px 0px #1f5fff29;
      }
    }
    .v-data-table__td {
      border-color: $color-bg-transparent !important;
    }
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }

  &__skeleton_loader :deep(*) {
    margin: 0;
  }

  &__header_cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.loading_skeleton {
  background-color: $color-table-row;

  .skeleton {
    background-color: $color-table-row;
  }
}

.copy-icon {
  margin-bottom: -0.2rem;
  cursor: pointer;
  color: $color-steel-blue;

  rotate: 180deg;
  transform: scaleX(-1);
}
</style>
