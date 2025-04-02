<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_all_funds"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading OIVs"
    items-per-page="-1"
    @mousedown:row="navigateFundDetails"
  >
    <template #[`item.name`]="{ item }">
      <FundNameCell
        :image="item.photoUrl"
        :title="item.title"
        :strategist-name="item.strategistName"
        :strategist-url="item.strategistUrl"
      />
    </template>

    <template #[`item.chainShort`]="{ item }">
      <Icon
        :icon="icon(item.chainShort).name"
        :width="icon(item.chainShort).size"
        :color="icon(item.chainShort)?.color"
        class="mr-2"
      />
    </template>

    <template #[`item.lastNAVUpdateTotalNAV`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else>
          {{
            formatTokenValue(
              item.lastNAVUpdateTotalNAV,
              item.baseToken.decimals,
            )
              +
              " " +
              item.baseToken.symbol
          }}
        </template>
      </div>
    </template>

    <!-- cumulative -->
    <template #[`item.cumulativeReturnPercent`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <div v-else :class="numberColorClass(item.cumulativeReturnPercent)">
          {{ formatPercent(item.cumulativeReturnPercent, true) ?? "N/A" }}
        </div>
      </div>
    </template>

    <template #[`item.positionTypeCounts`]="{ item }">
      <PositionTypesBar :position-type-counts="item.positionTypeCounts ?? []" class="position_types_bar" />
    </template>

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>

  <div v-else-if="items.length === 0 && !loading" class="nav_entries__no_data">
    No OIVs available.
  </div>
</template>

<script lang="ts" setup>
import {
  formatPercent,
  formatTokenValue,
} from "~/composables/formatters";
import { numberColorClass } from "~/composables/numberColorClass.js";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import { getChainIcon } from "~/composables/utils";
import type IFund from "~/types/fund";
import PositionTypesBar from "../fund/info/PositionTypesBar.vue";
import FundNameCell from "./components/FundNameCell.vue";

const { getFundDetailsUrl } = usePageNavigation();
const router = useRouter();

defineProps({
  items: {
    type: Array as () => IFund[],
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const headers: any = computed(() => [
  {
    title: "OIV Name",
    key: "name",
    sortable: false,
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
    title: "Latest NAV",
    key: "lastNAVUpdateTotalNAV",
    align: "end",
  },
  // {
  //   title: "Latest NAV Date",
  //   key: "lastNavUpdateTime",
  //   value: (v: IFund) => v.lastNavUpdateTime,
  //   align: "end",
  // },
  {
    title: "Inception",
    key: "inceptionDate",
    value: (v: IFund) => v.inceptionDate,
    align: "end",
  },
  {
    title: "Cumulative",
    key: "cumulativeReturnPercent",
    value: (v: IFund) => formatPercent(v.cumulativeReturnPercent, true),
    align: "end",
  },
  // {
  //   title: "Monthly",
  //   key: "monthlyReturnPercent",
  //   maxWidth: 100,
  //   value: (v: IFund) => formatPercent(v.monthlyReturnPercent, true),
  //   align: "end",
  // },

  // TODO: show sharpe ratio later
  // {
  //   title: "Sharpe Ratio",
  //   key: "sharpeRatio",
  //   maxWidth: 100,
  //   value: (v: IFund) => v.sharpeRatio || "N/A",
  //   align: "end",
  // },
  {
    title: "Position Types",
    key: "positionTypeCounts",
    align: "end",
  },
]);

const icon = (chainShort: string) => {
  const icon = getChainIcon(chainShort);
  return {
    name: icon?.name,
    size: icon?.size,
    color: icon?.color,
  };
};

const navigateFundDetails = (event: any, row: any) => {
  // Check if the click target is an anchor (<a>) or any clickable element
  const target = event.target as HTMLElement;

  if (target.tagName.toLowerCase() === "a" || target.closest("a")) {
  // If the target is an anchor tag, prevent the row navigation
    return;
  }


  const fundDetailsUrl = getFundDetailsUrl(
    row.item.chainId,
    row.item.fundToken.symbol,
    row.item.address,
  );

  // Check if the middle mouse button or a modifier key (e.g., Ctrl/Command) is pressed
  if (event.button === 1 || event.metaKey || event.ctrlKey) {
    // Allow the default behavior (open in a new tab)
    window.open(fundDetailsUrl, "_blank");
  } else {
    // Normal left-click behavior (navigate)
    router.push(fundDetailsUrl);
  }
};
</script>

<style lang="scss" scoped>
.table_all_funds {
  @include borderGray;
  border-color: $color-bg-transparent;
  // add table max height
  :deep(.v-table__wrapper) {
    @include customScrollbar(0);

    .v-data-table__tr {
      height: 72px;
      cursor: pointer;
      transition: background-color 0.3s ease, box-shadow 0.3s ease;
      color: $color-steel-blue;
      outline: 2px solid #111c35;
      background-color: $color-table-row;

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

.position_types_bar{
  max-width: 100px;
  margin-left: auto;
}
</style>
