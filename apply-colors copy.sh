#!/usr/bin/env bash
# ----------------------------------------------------------------------
# rethink.finance — color refresh installer
# Writes 9 color-only updated files into this repo. No logic changed.
# Usage:  put this file in your repo root, then run:  bash apply-colors.sh
# ----------------------------------------------------------------------
set -euo pipefail

if [ ! -f "nuxt.config.ts" ]; then
  echo "ERROR: nuxt.config.ts not found."
  echo "Run this script from the rethink-frontend-v2-main repo root."
  exit 1
fi

if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Tip: you're in a git repo — review changes after with 'git diff' and you can revert anytime."
else
  echo "Note: not a git repo here. Make a backup copy of the folder before running if you want a safety net."
fi

echo "Writing updated files..."

echo "  -> assets/scss/_variables.scss"
mkdir -p "assets/scss"
cat > "assets/scss/_variables.scss" <<'__RETHINK_COLOR_PATCH_EOF__'
$navbar-height: 5rem;
$default-transition-time: 0.28s;
$color-white: #eceef4; // Approx 95% white
$color-black: #333333;

/* Utility colors */
/*
  TODO THIS PALLETE NEEDS REFACTOR
  The colors were changing in the design all the time and
  a lot of them are super similar and redundant.
 */
$color-dark: #0c0d12;
$color-navy-gray: #12141c;
$color-navy-gray-light: #171a24;
$color-navy-gray-dark: #0f1118;
$color-table-row: #171a24;
$color-hover: #1d212d;
$color-badge-navy: #171a24;
$color-border-dark: #242833;
$color-toast: #1d212d;
$color-moonlight-dark: #1d212d;
$color-moonlight: rgba(31, 95, 255, 0.13);
$color-moonlight-light: #2a2f3c;
$color-disabled: #646465;
$color-gray-transparent: rgba(255, 255, 255, 0.08);
$color-gray-light-transparent: rgba(255, 255, 255, 0.04);
$color-divider: #1a1d27;
$color-light-border: rgba(128, 136, 152, 1);
$color-box-shadow: rgba(31, 95, 255, 0.16);
$color-midnight-blue: #0c0d1229;
$color-bg-transparent: #FFFFFF05;
$color-bg-toast: #1D212D;

/* Vuetify colors */
// Currently also defined in the plugins/vuetify.ts
$color-background: $color-dark;
$color-surface: #12141c;
$color-primary: #1f5fff;
$color-primary-dark: #1747c9;
$color-primary-darker: #1c3165;
$color-secondary: #d2dfff;
$color-secondary-dark: #969cac;
$color-error: #e66a60;
$color-error-text: white;
$color-info: #16c8ff;
$color-success: #35bd48;
$color-success-light: #38de8e;
$color-success-text: white;
$color-warning: #ffd33d;
$color-warning-text: #836900;
$color-inactive: #4e5972;
$color-steel-blue: #808898;
$color-card-background: rgba(255, 255, 255, 0.02);
$color-background-button: rgba(255, 255, 255, 0.06);

/* Typography */
$color-title: $color-white;
$color-subtitle: #808898;
$color-light-subtitle: rgba(255, 255, 255, 0.76);
$color-text-irrelevant: #969cac;

$text-xl: 1.5rem;
$text-lg: 1.25rem;
$text-md: 1rem;
$text-sm: 0.875rem;
$text-xs: 0.75rem;
.text-xl { font-size: $text-xl; }
.text-lg { font-size: $text-lg; }
.text-md { font-size: $text-md; }
.text-sm { font-size: $text-sm; }
.text-xs { font-size: $text-xs; }

$letter-spacing-lg: 0.03rem;
// Status Type Colors
$color-status-type-active: #db38de;
$color-status-type-executed: $color-success-light;
$color-status-type-defeated: $color-error;
$color-status-type-to-execute: $color-primary;
$color-status-type-canceled: #de6a38;

// Use these variables to generate CSS rules
$proposal-states: (
  "active": $color-status-type-active,
  "executed": $color-status-type-executed,
  "defeated": $color-status-type-defeated,
  "to_execute": $color-status-type-to-execute,
  "canceled": $color-status-type-canceled,
);

@each $state, $color in $proposal-states {
  .proposal_state_#{$state} {
    color: $color;
  }
}

// Position Type Colors
$color-position-type-liquid: #de6a38;
$color-position-type-composable: #38de8e;
$color-position-type-nft: #741fff;
$color-position-type-illiquid: #ffd700;

// Use these variables to generate CSS rules
$position-types: (
  "liquid": $color-position-type-liquid,
  "composable": $color-position-type-composable,
  "nft": $color-position-type-nft,
  "illiquid": $color-position-type-illiquid,
);

@each $type, $color in $position-types {
  .position_type_#{$type} {
    color: $color;
  }
}

// Breakpoints
$screen-xs: 360px; // Extra small screen / phone
$screen-sm: 480px; // Mobile
$screen-md: 768px; // Tablet
$screen-lg: 960px; // Desktop (small)
$screen-xl: 1200px; // Desktop (large)
$screen-xxl: 1460px; // Desktop (extra large)
$screen-xxxl: 1860px; // Desktop (XXXL)

/**
Define the needed colors as CSS variables, as they can be used in certain
plugins like Apexcharts with "var(--color-something)" to prevent redefining colors.
 */
:root {
  --color-primary: #{$color-primary};
  --color-subtitle: #{$color-subtitle};
  --color-divider: #{$color-divider};
  --color-light-subtitle: #{$color-light-subtitle};
  --color-gray-light-transparent: #{$color-gray-light-transparent};
  --color-success: #{$color-success};
  --color-warning: #{$color-warning};
  --color-error: #{$color-error};
}
$default-border-radius: 0.25rem;

// Define a mixin to apply border properties based on position
// Define a variable for border properties
$default-border-properties: (
  "border": 1px solid $color-gray-transparent,
);
@mixin borderGray(
  $position: "border",
  $border-radius: true,
  $border-color: $color-gray-transparent
) {
  // Apply border radius if enabled
  @if $border-radius {
    border-radius: $default-border-radius;
  }

  // Apply specific border position.
  #{$position}: 1px solid $border-color;
}

// include offset as a argument
@mixin customScrollbar($offset: 10px) {
    // offset the scrollbar to the left
    padding-right: $offset;
    margin-right: -$offset;

    /* Custom scrollbar styles */
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    &::-webkit-scrollbar-track {
      background: $color-subtitle;
      border-radius: 16px;
    }

    &::-webkit-scrollbar-thumb {
      background: $color-primary;
      border-radius: 16px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: $color-steel-blue;
    }
}
__RETHINK_COLOR_PATCH_EOF__

echo "  -> plugins/vuetify.ts"
mkdir -p "plugins"
cat > "plugins/vuetify.ts" <<'__RETHINK_COLOR_PATCH_EOF__'
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify, type ThemeDefinition } from "vuetify";
import { md2 } from "vuetify/blueprints";

// TODO use colors from _variables.scss, convert to var(--color-primary)
const customDarkTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: "#0C0D12",
    surface: "#12141C",
    primary: "#1F5FFF",
    "primary-darken-1": "#1747C9",
    secondary: "#D2DFFF",
    "secondary-darken-1": "#8E97AD",
    error: "#E66A60",
    info: "#16C8FF",
    success: "#38DE38",
    warning: "#FB8C00",
  },
};

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    // ... your configuration goes here
    ssr: true,
    blueprint: md2,
    aliases: {

    },
    defaults: {
      global: {
        ripple: false,
      },
    },
    theme: {
      defaultTheme: "customDarkTheme",
      themes: {
        customDarkTheme,
      },
    },
  });
  nuxtApp.vueApp.use(vuetify);
});
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/table/Table.vue"
mkdir -p "components/table"
cat > "components/table/Table.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<template>
  <div class="table_wrapper">
    <table
      class="rethink-table"
      :style="{ background: bgColor, ...customStyle }"
    >
      <caption v-if="showControls" class="table-caption">
        <div class="table-navbar-content">
          <slot name="table-navbar-content" />
          <input
            v-if="isFilterable"
            v-model="filtering"
            placeholder="Search by name..."
            @input="filterTable"
          >
        </div>
      </caption>
      <thead v-if="showHeader">
        <tr
          v-for="headerGroup in table.getHeaderGroups()"
          :key="headerGroup.id"
          :style="{ height: headerHeight }"
        >
          <th
            v-for="header in headerGroup.headers"
            :key="header.id"
            :style="{
              ...tableHeadDefaultStyle,
            }"
            :colspan="header.colSpan"
            :class="{sortable: header.column.getCanSort()}"
            @click="toggleSorting(header.column)"
          >
            <div class="th_cell">
              <FlexRender
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
              <div v-if="header.column.getCanSort()">
                <IconSortArrows :sort="header.column.getIsSorted()" />
              </div>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :style="{ height: rowHeight }"
          @click="navigateFundDetails(row)"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :data-cell="cell.column.columnDef.header"
          >
            <div
              class="td-cell"
              :class="getCellClass(cell)"
              :style="getColumnWidth(cell.column.columnDef)"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </div>
            <!-- {{ cell.column.columnDef.cell(row.original) }} -->
          </td>
        </tr>
      </tbody>
      <tfoot>
        <!-- pagination logic here -->
      </tfoot>
    </table>
    <!--    <div v-if="showPagination" class="rethink-pagination-container" :style="{ marginTop: '16px' }">-->
    <!--      <div class="rethink-pagination-actions d-flex" style="gap: 20px">-->
    <!--        <v-btn-->
    <!--          variant="text"-->
    <!--          :disabled="!table.canPreviousPage"-->
    <!--          @click="gotoPage(0)"-->
    <!--        >-->
    <!--          First Page-->
    <!--        </v-btn>-->
    <!--        <v-btn-->
    <!--          variant="text"-->
    <!--          :disabled="!table.canPreviousPage"-->
    <!--          @click="previousPage"-->
    <!--        >-->
    <!--          Previous Page-->
    <!--        </v-btn>-->
    <!--        <v-btn variant="text" :disabled="!table.canNextPage" @click="nextPage">-->
    <!--          Next Page-->
    <!--        </v-btn>-->
    <!--        <v-btn-->
    <!--          variant="text"-->
    <!--          :disabled="!table.canNextPage"-->
    <!--          @click="gotoPage(table.getPageCount() - 1)"-->
    <!--        >-->
    <!--          Last Page-->
    <!--        </v-btn>-->
    <!--      </div>-->
    <!--    </div>-->
  </div>
</template>

<script lang="ts" setup>
import {
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { onMounted, ref, watch } from "vue";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";

const { navigateToFundDetails } = usePageNavigation();

const props = defineProps({
  captionSide: {
    type: String,
    default: "",
  },
  showControls: Boolean,
  columns: {
    type: Array as () => any[],
    default: () => [],
  },
  data: {
    type: Array as () => any[],
    default: () => [],
  },
  isPaginated: Boolean,
  isSortable: Boolean,
  isFilterable: Boolean,
  showHeader: {
    type: Boolean,
    default: true,
  },
  showPagination: {
    type: Boolean,
    default: false,
  },
  btnType: {
    type: String,
    default: "",
  },
  bgColor: {
    type: String,
    default: "transparent",
  },
  headerHeight: {
    type: String,
    default: "3.5rem",
  },
  rowHeight: {
    type: String,
    default: "4.5rem",
  },
  customStyle: {
    type: Object,
    default: () => {},
  },
  captionSpacing: {
    type: String,
    default: "2rem",
  },
  onSortingChange: {
    type: Function,
    default: () => {console.log("onsorting")},
  },
  getCellClass: {
    type: Function,
    default: () => {},
  },
});

const filtering = ref("");
const tableHeadDefaultStyle = ref({
  borderBottom: "3px solid #1D212D",
});

const table = useVueTable({
  columns: props.columns ?? [],
  data: props.data ?? [],
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  defaultColumn: {
    minSize: 60,
    size: 70,
    maxSize: 250,
  },
});

// const shouldShowBottomBorder = (row) => {
//   return row.index + 1 !== table.rows.length ? "1px solid #F2F2F2" : "";
// };

const getColumnWidth = (column: any) => {
  const styles: Record<string, string> = {};
  if (column.size) {
    styles.width = column.size;
    if (column.size !== "auto") {
      styles.width += "px";
    }
    styles.width = "100%"
  }
  if (column.minSize) {
    styles["min-width"] = column.minSize + "px";
  }
  if (column.maxSize) {
    styles["max-width"] = column.maxSize + "px";
  }

  return styles
};

const toggleSorting = (column: any) => {
  if (column.getCanSort()) {
    column.toggleSorting(undefined, column.getCanMultiSort())
  }
};
const filterTable = (value: any) => {
  filtering.value = value;
};

const navigateFundDetails = (row: any) => navigateToFundDetails(
  row.original.chainId,
  row.original.fundToken.symbol,
  row.original.address,
);

// const gotoPage = (pageIndex: any) => {
//   table.setPageIndex(pageIndex);
// };
//
// const previousPage = () => {
//   table.previousPage();
// };
//
// const nextPage = () => {
//   table.nextPage();
// };

onMounted(() => {
  table.setPageIndex(0);
});

watch([() => props.data, () => props.columns], () => {
  console.log("refresh table");
  // table.refresh();
});
</script>

<style lang="scss" scoped>
.table_wrapper {
  overflow: auto;
  @include customScrollbar;
}
.rethink-table {
  $cell-padding-inlinee: 1rem;
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  font-size: $text-sm;
  font-weight: 500;

  caption {
    caption-side: top;
    padding-top: 2rem;
    padding-bottom: 2rem;
  }
  .table-navbar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  input[type="text"] {
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 5px;
    width: 100%;
  }
  thead {
   border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    th {
      padding-inline: $cell-padding-inlinee;
      background: $color-surface;
      color: $color-light-subtitle;
      font-weight: 500;
      letter-spacing: 0.02625rem;

      &.sortable:hover {
        cursor: pointer;
      }
      &:not(:first-child) .th_cell {
        justify-content: flex-end;
      }
      .th_cell {
        display: flex;
        gap: 5px;
        align-items: center;
        text-align: start;

        .sort {
          margin-left: 0.125rem;
          position: relative;
          top: 2px;
        }

        // active sort arrow color
        :deep(.sort .sort__arrow--active) {
          path{
            fill: $color-primary;
          }
        }
      }
    }
  }
  tbody {
    tr {
      outline: 2px solid #1d212d;
      border-bottom: 2px solid #242833;
      cursor: pointer;
      color: $color-white;

      // First column is aligned left, others right.
      :not(:first-child) .td-cell {
        text-align: right;
        justify-content: flex-end;
      }

      td {
        padding-inline: $cell-padding-inlinee;

        .td-cell {
          width: 100%;
          overflow: hidden;
          @include ellipsis;
        }
      }
      &:hover {
        background: $color-gray-transparent;
      }
    }
  }
}


th,
td,
caption {
  //padding: 1rem;
  text-align: start;
}

tr:not(th tr) {
  background: $color-table-row;
}


.rethink-table .rethink-pagination-container {
  margin-top: 16px;
}

.rethink-table .rethink-pagination-actions {
  display: flex;
  gap: 10px;
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/table/TableFunds.vue"
mkdir -p "components/table"
cat > "components/table/TableFunds.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_all_funds"
    :headers="headers"
    hover
    :items="items"
    :sort-by="[{ key: 'totalSimulatedNavUSD', order: 'desc' }]"
    :loading="loading && items.length === 0"
    loading-text="Loading OIVs"
    items-per-page="-1"
    @mousedown:row="navigateFundDetails"
  >
    <template #[`item.name`]="{ item }">
      <FundNameCell
        :image="item.photoUrl"
        :title="item.title"
        :subtitle="getItemSubtitle(item)"
      />
    </template>

    <template #[`item.curator`]="{ item }">
      <div v-if="item.strategistName" class="curator-cell">
        <a
          v-if="item.strategistUrl"
          :href="item.strategistUrl"
          target="_blank"
          class="curator-link"
        >
          {{ item.strategistName }}
        </a>
        <span v-else>{{ item.strategistName }}</span>
      </div>
      <div v-else>
        -
      </div>
    </template>

    <template #[`item.chainShort`]="{ item }">
      <IconChain :chain-short="item.chainShort" class="mr-2" />
    </template>

    <template #[`item.baseAsset`]="{ item }">
      <div class="base-asset-cell">
        <BaseAssetIcon
          :chain-id="item.chainId"
          :chain-short="item.chainShort"
          :token-address="item.baseToken.address"
          class="mr-2"
        />
      </div>
    </template>

    <template #[`item.totalSimulatedNavUSD`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <template
          v-else-if="!item.totalSimulatedNav && !item.lastNAVUpdateTotalNAV"
        >
          N/A
        </template>
        <template v-else>
          <v-tooltip
            v-if="item.totalSimulatedNav && item.totalSimulatedNavCalculatedAt"
            :disabled="!appSettingsStore.isManageMode"
            location="bottom"
          >
            <template #activator="{ props }">
              <div class="d-flex flex-column" v-bind="props">
                <div class="text-white">
                  {{
                    formatNumberShort(
                      formatTokenValue(
                        item.totalSimulatedNav || item.lastNAVUpdateTotalNAV,
                        item.baseToken.decimals,
                        false,
                        false,
                      ),
                    ) +
                      " " +
                      item.baseToken.symbol
                  }}
                </div>
                <div v-if="item.totalSimulatedNavUSD" class="nav_usd_value">
                  ${{ formatNumberShort(item.totalSimulatedNavUSD) }}
                </div>
              </div>
            </template>
            Calculated on
            <strong>{{ item.totalSimulatedNavCalculatedAt }}</strong>
          </v-tooltip>
          <v-tooltip
            v-else
            location="bottom"
            :disabled="!appSettingsStore.isManageMode"
          >
            <template #activator="{ props }">
              <span v-bind="props">
                {{
                  formatNumberShort(
                    formatTokenValue(
                      item.totalSimulatedNav || item.lastNAVUpdateTotalNAV,
                      item.baseToken.decimals,
                    ),
                  ) +
                    " " +
                    item.baseToken.symbol
                }}
              </span>
            </template>
            <strong>
              <template v-if="item?.navUpdates?.length > 0">
                Based on the last NAV update
              </template>
              <template v-else> Based on the current NAV methods. </template>
            </strong>
          </v-tooltip>
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
        <div
          v-else
          :class="numberColorClass(roundPercent(item.cumulativeReturnPercent))"
        >
          {{
            formatPercent(roundPercent(item.cumulativeReturnPercent), true) ??
              "N/A"
          }}
        </div>
      </div>
    </template>

    <!-- apr -->
    <template #[`item.apr`]="{ item }">
      <div :class="{ 'justify-center': item.isNavUpdatesLoading }">
        <v-progress-circular
          v-if="item.isNavUpdatesLoading"
          size="18"
          width="2"
          indeterminate
        />
        <template v-else>
          <div :class="numberColorClass(roundPercent(getApr(item)))">
            {{
              getApr(item) === undefined
                ? "--"
                : formatPercent(roundPercent(getApr(item)), true)
            }}
          </div>
        </template>
      </div>
    </template>

    <!--    <template #[`item.positionTypeCounts`]="{ item }">-->
    <!--      <PositionTypesBar-->
    <!--        :position-type-counts="item.positionTypeCounts ?? []"-->
    <!--        class="position_types_bar"-->
    <!--      />-->
    <!--    </template>-->

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>

  <div v-else-if="items.length === 0 && !loading" class="nav_entries__no_data">
    No OIVs available.
  </div>
</template>

<script lang="ts" setup>
import BaseAssetIcon from "../global/icon/BaseAsset.vue";
import FundNameCell from "./components/FundNameCell.vue";
import {
  formatNumberShort,
  formatPercent,
  formatTokenValue,
} from "~/composables/formatters";
import { calculateAPR } from "~/composables/utils";
import { numberColorClass } from "~/composables/numberColorClass.js";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";
import type IFund from "~/types/fund";
import { useSettingsStore } from "~/store/settings/settings.store";
import { fundMetaDataHardcoded } from "~/store/funds/config/fundMetadata.config";
import { ChainId } from "~/types/enums/chain_id";

const { getFundDetailsUrl } = usePageNavigation();
const router = useRouter();
const appSettingsStore = useSettingsStore();

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

const roundPercent = (value?: number): number => parseFloat(value?.toFixed(2) || "0");

const getApr = (fund: IFund): number | undefined =>
  calculateAPR(fund.cumulativeReturnPercent, fund.inceptionDateTimestamp);

const headers: any = computed(() => [
  {
    title: "Vault Name",
    key: "name",
    sortable: false,
  },
  {
    title: "Current NAV",
    key: "totalSimulatedNavUSD",
    align: "end",
    width: 150,
  },
  {
    title: "Curator",
    key: "curator",
    sortable: false,
    width: 180,
  },
  {
    title: "Base Asset",
    key: "baseAsset",
    width: 125,
    align: "start",
  },
  {
    title: "Chain",
    key: "chainShort",
    width: 65,
    align: "end",
  },
  // {
  //   title: "Latest NAV Date",
  //   key: "lastNavUpdateTime",
  //   value: (v: IFund) => v.lastNavUpdateTime,
  //   align: "end",
  // },
  // {
  //   title: "Inception",
  //   key: "inceptionDate",
  //   value: (v: IFund) => v.inceptionDate,
  //   align: "end",
  // },
  {
    title: "Cumulative Return",
    key: "cumulativeReturnPercent",
    align: "end",
    width: 170,
  },
  {
    title: "APR",
    key: "apr",
    align: "end",
    width: 100,
    sortable: false,
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
  // {
  //   title: "Position Types",
  //   key: "positionTypeCounts",
  //   align: "end",
  // },
]);

const getItemSubtitle = (fund: IFund) => {
  // Get subtitle from fundMetadata if available, otherwise use the provided subtitle
  if (fund.address && fund.chainId) {
    // Find the fund in the metadata by address
    const chainFunds = fundMetaDataHardcoded[fund.chainId as ChainId] || [];
    const fundMetadata = chainFunds.find(
      (fundMetadata) =>
        fundMetadata.address.toLowerCase() === fund.address.toLowerCase(),
    );

    // If found and has a subtitle, use it
    if (fundMetadata?.subtitle) {
      return fundMetadata.subtitle;
    }
  }

  // Fallback to the provided subtitle
  return fund.description;
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
  max-width: 100%;
  // add table max height
  :deep(.v-table__wrapper) {
    @include customScrollbar(0);
    table {
      table-layout: fixed;
    }

    .v-data-table__tr {
      height: 85px;
      cursor: pointer;
      transition:
        background-color 0.3s ease,
        box-shadow 0.3s ease;
      color: $color-light-subtitle;
      outline: 2px solid #1d212d;
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

.nav_usd_value {
  color: $color-light-subtitle;
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

.position_types_bar {
  max-width: 100px;
  margin-left: auto;
}

.curator-cell {
  .curator-link {
    color: $color-light-subtitle;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: $color-primary;
      text-decoration: underline;
    }
  }
}

.base-asset-cell {
  display: flex;
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/global/ui/toast/index.vue"
mkdir -p "components/global/ui/toast"
cat > "components/global/ui/toast/index.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<template>
  <v-snackbar
    v-for="toast in toasts"
    :key="toast.id"
    :model-value="true"
    :timeout="toast.duration"
    :class="['toast', backgroundClass(toast.level), 'text'+textColorClass(toast.level)]"
    multi-line
  >
    <div class="toast_content">
      <Icon
        v-if="toastIcon(toast.level)"
        :icon="toastIcon(toast.level)"
        width="1.5rem"
        class="icon__toast"
      />

      <div class="message">
        {{ toast.message }}
      </div>
    </div>

    <template #actions>
      <v-btn
        :class="['btn-close', 'btn-close'+textColorClass(toast.level)]"
        icon
        @click="toastStore.closeToast(toast.id)"
      >
        <Icon
          icon="octicon:x-16"
          width="1.5rem"
          class="icon"
        />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
import { useToastStore } from "~/store/toasts/toast.store";
const toastStore = useToastStore();
const toasts = ref(toastStore.toasts);

watch(() => toastStore.toasts, (newToasts) => {
  toasts.value = newToasts;
});

const backgroundClass = (level) => {
  // Define your mapping of levels to background classes
  const levelClasses = {
    success: "toast-success",
    warning: "toast-warning ",
    error: "toast-danger",
  };

  // Return the corresponding class for the given level
  return levelClasses[level] || "";
};

const toastIcon = (level) => {
  // Define your mapping of levels to icons
  const levelIcons = {
    success: "material-symbols:check-circle-outline",
    warning: "material-symbols:warning-outline",
    error: "material-symbols:error-outline",
  };

  // Return the corresponding icon for the given level
  return levelIcons[level] || "";
};

const textColorClass = (level) => {
  // Set text color to white for levels other than info
  return level && level !== "info" ? "-white" : "";
};
</script>

<style lang="scss" scoped>
:deep(.v-overlay__content.v-snackbar__wrapper){
  background-color: $color-bg-toast;
  color: $color-white;

  box-shadow: 0px 0px 16px 0px $color-box-shadow;
}

.toast_content {
  display: flex;
  align-items: center;
  gap: 14px;

  .icon__toast {
    width: 30px;
  }

  .message{
    max-width: calc(100% - 30px);
  }
}
.toast-success {
  .icon__toast {
    color: $color-success;
  }
}
.toast-danger {
  .icon__toast {
    color: $color-error;
  }
}
.toast-warning {
  .icon__toast {
    color: $color-warning;
  }
}

:deep(.v-overlay__content.v-snackbar__wrapper) {
  .v-snackbar__content {
    font-weight: 500;
    line-height: 150%;
  }
}
:deep(.v-btn){
  color: $color-secondary !important;
  height: 2.5rem !important;
  width: 2.5rem !important;
  padding: 0 !important;
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/fund/Navigation.vue"
mkdir -p "components/fund"
cat > "components/fund/Navigation.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import type IRoute from "~/types/route";
import { useSettingsStore } from "~/store/settings/settings.store";

const props = defineProps<{
  routes: IRoute[];
  fundDetailsRoute: string;
}>();

const route = useRoute();
const appSettingsStore = useSettingsStore();

const isPathActive = (path: string = "", exactMatch = true) =>
  exactMatch ? route?.path === path : route?.path.startsWith(path);

const getPathColor = (isActive = false, color = "#808898") =>
  isActive ? "primary" : color;

const computedRoutes = computed(() => {
  const showInManageMode = [
    `${props.fundDetailsRoute}/flows`,
    `${props.fundDetailsRoute}/execution-app`,
    `${props.fundDetailsRoute}/permissions`,
  ]
  return props.routes.map((routeItem: IRoute) => {
    const isHidden = showInManageMode.includes(routeItem.to) ? !appSettingsStore.isManageMode : false;

    let isActive;
    if (routeItem.exactMatch) {
      isActive = isPathActive(routeItem.to, true);
    } else if (
      isPathActive(routeItem.matchPrefix, false) ||
      isPathActive(routeItem.to, true)
    ) {
      isActive = true;
    } else {
      isActive = false;
    }

    return {
      ...routeItem,
      isActive,
      pathColor: getPathColor(isActive, routeItem.color),
      target: routeItem.isExternal ? "_blank" : "",
      isHidden,
    };
  }).filter((routeItem: IRoute) => !routeItem.isHidden);
});
</script>

<template>
  <div class="details_nav_container">
    <div class="details_nav">
      <div class="overlay-container" />
      <nuxt-link
        v-for="navRoute in computedRoutes"
        :key="navRoute.to"
        :to="navRoute.to"
        class="link"
      >
        <v-btn
          class="nav-link"
          variant="plain"
          :active="navRoute.isActive"
          :color="navRoute.pathColor"
        >
          <div :class="{ 'title-box': navRoute.isActive }">
            {{ navRoute.title }}
          </div>
        </v-btn>
      </nuxt-link>
    </div>
  </div>
</template>

<style scoped lang="scss">
.details_nav {
  position: relative;
  padding-top: 8px;
  width: 100%;
}

.details_nav_container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 4px;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-bottom: 8px;
  margin-bottom: 40px;

  background-color: $color-bg-transparent;
  border-radius: 4px;

  @include sm {
    padding-left: 0;
    padding-right: 0;
  }
}

.link {
  &:first-of-type {
    .nav-link {
      padding-left: 8px;
    }
  }
}

.nav-link {
  height: 100%;
  text-transform: Capitalize;
  font-size: 1rem;
  font-weight: 700;
  padding: 0.5rem;

  &:not(:hover) {
    opacity: 0.85;
  }
}

.title-box {
  position: relative;
  border-bottom: 2px solid;
  border-color: var(--color-primary);
  padding-bottom: 1rem;
}

.overlay-container {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);

  background-color: var(--color-divider);
  width: calc(100% - 16px);
  height: 2px;
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/fund/chart/index.vue"
mkdir -p "components/fund/chart"
cat > "components/fund/chart/index.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<template>
  <div class="chart">
    <div class="chart__toolbar">
      <div>
        <FundChartTypeSelector
          v-model:selected="selectedType"
          :value="valueShownInTypeSelector"
          :is-loading="
            areBackendNavUpdatesLoading &&
              selectedType === ChartType.SHARE_PRICE
          "
          :type-options="ChartTypesMap"
        />
      </div>
      <!--      <FundChartTimelineSelector selected="3M" @change="updateChart" />-->
    </div>
    <div class="chart__chart_wrapper">
      <v-skeleton-loader
        v-if="areBackendNavUpdatesLoading"
        type="ossein"
        height="370px"
        width="100%"
      />
      <!--      <v-skeleton-loader-->
      <!--        v-else-if="areBackendNavUpdatesLoading && selectedType === ChartType.SHARE_PRICE"-->
      <!--        type="ossein"-->
      <!--        height="370px"-->
      <!--        width="100%"-->
      <!--      />-->
      <div v-else class="meta">
        <ClientOnly>
          <apexchart
            v-if="chartPoints.length > 0"
            height="370"
            width="100%"
            :options="options"
            :series="series"
          />
          <div
            v-else
            class="w-100 d-flex justify-center align-center h-100 my-4"
          >
            <h3 v-if="selectedType == ChartType.NAV">
              NAV data is currently not available.
            </h3>
            <h3 v-else-if="selectedType == ChartType.SHARE_PRICE">
              Share price data is currently not available.
            </h3>
            <h3 v-else>
              Data is currently not available.
            </h3>
          </div>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ethers } from "ethers";
import { ERC20 } from "~/assets/contracts/ERC20";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ActionState } from "~/types/enums/action_state";
import {
  ChartType,
  ChartTypesMap,
  ChartTypeStrokeColors,
} from "~/types/enums/chart_type";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import {
  fetchFundNavUpdatesAction,
  type ParsedNavUpdateDto,
} from "~/store/funds/actions/fetchFundNavUpdates.action";
import { formatDate, formatDateLong } from "~/composables/formatters";
import { abbreviateNumber } from "~/composables/abbreviateNumber";
import { useSettingsStore } from "~/store/settings/settings.store";

const fundStore = useFundStore();
const blockTimeStore = useBlockTimeStore();
const web3Store = useWeb3Store();
const actionStateStore = useActionStateStore();
const appSettingsStore = useSettingsStore();

const props = defineProps<{
  fund: IFund;
}>();

const selectedType = ref(ChartType.SHARE_PRICE);

const sharePriceItemsFromChain = ref([]) as Ref<number[]>;
const areBackendNavUpdatesLoading = ref(true);
const navUpdatesFromBackend = ref<ParsedNavUpdateDto[]>([]);

// Computed
const lastChartPoint = computed(
  () => chartPoints.value[chartPoints.value.length - 1],
);
const valueShownInTypeSelector = computed(() => {
  if (selectedType.value === ChartType.NAV) {
    return fundStore.getFormattedBaseTokenValue(
      lastChartPoint.value?.valueRaw || 0n,
    );
  }
  if (selectedType.value === ChartType.SHARE_PRICE) {
    return abbreviateNumber(
      props.fund?.sharePrice || lastChartPoint.value?.y || 0,
      3,
    );
  }

  return "N/A";
});

const series = computed(() => [
  {
    name: ChartTypesMap[selectedType.value].value,
    data: chartPoints.value,
  },
]);

const fundNavUpdates = computed<INAVUpdate[] | ParsedNavUpdateDto[]>(() =>
  // INAVUpdate comes from the chain, and ParseNavUpdateDto is from the backend.
  navUpdatesFromBackend.value.length
    ? navUpdatesFromBackend.value
    : (props.fund?.navUpdates ?? []),
);

const sharePriceItems = computed<number[]>(() => {
  if (navUpdatesFromBackend.value.length > 0) {
    return navUpdatesFromBackend.value.map((u) => u.sharePrice);
  }

  return sharePriceItemsFromChain.value;
});

// Check loading state for daily snapshots action
const isLoadingDailySnapshots = computed(() =>
  actionStateStore.isActionState(
    `fetchFundDailyNavSnapshots_${props.fund.chainId}_${props.fund.address}`,
    ActionState.Loading,
  ),
);

// Shared chart points builder to keep logic in one place
type ChartPoint = {
  timestamp: number;
  date: string;
  x: number;
  y: number;
  valueRaw?: bigint;
  isSimulated: boolean;
  navUpdateIndex: number | null;
};

// NAV-only chart points
const navChartPoints = computed<ChartPoint[]>(() => {
  const baseTokenDecimals = props.fund?.baseToken?.decimals;
  if (!baseTokenDecimals) {
    return [];
  }
  // NAV updates.
  // INAVUpdate comes from the chain, and ParseNavUpdateDto is from the backend.
  const navUpdates = (fundNavUpdates.value || []).map(
    (navUpdate: INAVUpdate | ParsedNavUpdateDto) => {
      const ts = navUpdate.timestamp;
      const navBig = (navUpdate.totalNAV || 0n) as bigint;
      return {
        timestamp: ts,
        date: navUpdate.date,
        x: ts,
        y: parseFloat(ethers.formatUnits(navBig, baseTokenDecimals)),
        valueRaw: navBig,
        isSimulated: false,
        navUpdateIndex: navUpdate.index,
      } as ChartPoint;
    },
  );

  // Daily NAV snapshots fetched from the backend.
  const dailyNavSnapshots: ChartPoint[] =
    !isLoadingDailySnapshots.value &&
    props.fund?.backendDailyNavSnapshots?.length
      ? props.fund.backendDailyNavSnapshots
        .filter((s) => s.totalSimulatedNav != null)
        .map((s) => {
          const ts = Number(s.timestamp);
          const navBig = s.totalSimulatedNav as bigint;
          return {
            timestamp: ts,
            date: formatDate(new Date(ts)),
            x: ts,
            y: parseFloat(ethers.formatUnits(navBig, baseTokenDecimals)),
            valueRaw: navBig,
            isSimulated: true,
            navUpdateIndex: null,
          } as ChartPoint;
        })
      : [];

  const points: ChartPoint[] = [...navUpdates, ...dailyNavSnapshots];

  // Add simulated NAV if available
  if (props.fund?.totalSimulatedNav) {
    const ts = props.fund.totalSimulatedNavCalculatedAtISO
      ? Date.parse(props.fund.totalSimulatedNavCalculatedAtISO)
      : Date.now();
    points.push({
      timestamp: ts,
      date: formatDate(new Date(ts)),
      x: ts,
      y: parseFloat(
        ethers.formatUnits(props.fund.totalSimulatedNav, baseTokenDecimals),
      ),
      valueRaw: props.fund.totalSimulatedNav,
      isSimulated: true,
      navUpdateIndex: null,
    });
  }

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
});

// Share-price-only chart points
const sharePriceChartPoints = computed<ChartPoint[]>(() => {
  // Base points from NAV updates timestamps and sharePrice items aligned by index
  const base: ChartPoint[] = (fundNavUpdates.value || [])
    .map((navUpdate: INAVUpdate | ParsedNavUpdateDto, idx: number) => {
      const price = sharePriceItems.value[idx];
      if (price == null) return null;
      const ts = navUpdate.timestamp;
      return {
        timestamp: ts,
        date: navUpdate.date,
        x: ts,
        y: price as number,
        isSimulated: false,
        navUpdateIndex: navUpdate.index,
      } as ChartPoint;
    })
    .filter(Boolean) as ChartPoint[];

  // Daily snapshots
  const snapshots: ChartPoint[] =
    !isLoadingDailySnapshots.value &&
    props.fund?.backendDailyNavSnapshots?.length
      ? props.fund.backendDailyNavSnapshots
        .filter((s) => s.sharePrice != null)
        .map((s) => {
          const ts = Number(s.timestamp);
          const price = Number(s.sharePrice);
          return {
            timestamp: ts,
            date: formatDate(new Date(ts)),
            x: ts,
            y: price,
            isSimulated: true,
            navUpdateIndex: null,
          } as ChartPoint;
        })
      : [];

  const points: ChartPoint[] = [...base, ...snapshots];

  // Add the current simulated share price if available
  if (props.fund?.sharePrice) {
    const ts = props.fund.totalSimulatedNavCalculatedAtISO
      ? Date.parse(props.fund.totalSimulatedNavCalculatedAtISO)
      : Date.now();
    points.push({
      timestamp: ts,
      date: formatDate(new Date(ts)),
      x: ts,
      y: props.fund.sharePrice,
      isSimulated: true,
      navUpdateIndex: null,
    });
  }

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
});

// Selector depending on the chosen type
const chartPoints = computed<ChartPoint[]>(() =>
  selectedType.value === ChartType.NAV
    ? navChartPoints.value
    : sharePriceChartPoints.value,
);

const chartPointValues = computed(() => chartPoints.value.map((p) => p.y));

// Indices of points that correspond to real NAV updates (have navUpdateIndex)
const navUpdateMarkerIndexes = computed<number[]>(() =>
  appSettingsStore.isManageMode
    ? chartPoints.value
      .map((p, idx) => (p.navUpdateIndex != null ? idx : -1))
      .filter((idx) => idx >= 0)
    : [],
);

const options = computed(() => {
  return {
    chart: {
      id: "nav-area-chart",
      type: "area",
      background: "var(--color-gray-light-transparent)",
      stacked: false,
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    markers: {
      size: 0,
      colors: ["transparent"],
      strokeColors: ChartTypeStrokeColors[selectedType.value],
      strokeWidth: 2,
      // Show markers only on points that have navUpdateIndex
      discrete: navUpdateMarkerIndexes.value.map((dataPointIndex) => ({
        seriesIndex: 0,
        dataPointIndex,
        size: 2,
        fillColor: "#1d212d",
        strokeColor: ChartTypeStrokeColors[selectedType.value],
        shape: "circle",
      })),
    },
    grid: {
      show: false,
      padding: {
        // This removes the right padding. Without removing it, we have a lot of
        // space on the right of the chart.
        right: 8,
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.25,
        opacityTo: 0.1,
        type: "vertical",
        stops: [20, 100],
      },
      colors: [ChartTypeStrokeColors[selectedType.value]],
    },
    stroke: {
      show: true,
      // curve: selectedType.value === ChartType.SHARE_PRICE ? "stepline" : "straight",
      curve: "straight",
      lineCap: "round",
      width: 2,
      colors: [ChartTypeStrokeColors[selectedType.value]],
    },
    yaxis: {
      // Set dynamic min and max values with a small buffer (5%) to ensure minor fluctuations
      // in NAV data do not appear overly exaggerated on the chart. This helps in providing a
      // more accurate visual representation when NAV values change slightly between updates.
      min: chartPointValues.value.length
        ? Math.min(...chartPointValues.value) * 0.95
        : undefined,
      max: chartPointValues.value.length
        ? Math.max(...chartPointValues.value) * 1.05
        : undefined,
      forceNiceScale: true,
      labels: {
        style: {
          colors: "var(--color-light-subtitle)",
        },
        offsetX: 0,
        formatter: (value: number) => {
          return abbreviateNumber(value, 3);
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    xaxis: {
      type: "datetime",
      tickAmount: 4,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      crosshairs: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
      labels: {
        style: {
          colors: "var(--color-light-subtitle)",
        },
      },
    },
    tooltip: {
      theme: "dark", // You can set the tooltip theme to 'dark' or 'light'
      custom: function ({
        seriesIndex,
        dataPointIndex,
        w,
      }: {
        seriesIndex: number;
        dataPointIndex: number;
        w: any;
      }) {
        const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
        let formattedDate = formatDate(new Date(dataPoint.x));
        const navUpdateIndex = dataPoint.navUpdateIndex;
        // Convert BigInt to string to avoid serialization issues
        const valueNav = dataPoint?.valueRaw?.toString() || "0";
        const valueSharePrice = Number(
          dataPoint?.y ?? props.fund.sharePrice ?? 0,
        );

        // Check if this is the simulated NAV data point
        const isSimulatedValue = dataPoint?.isSimulated;
        const isLastValue = dataPointIndex === chartPoints.value?.length - 1;

        const labelTextMap = {
          [ChartType.NAV]: "NAV",
          [ChartType.SHARE_PRICE]: "Share Price",
        };

        const labelText = labelTextMap[selectedType.value];
        // if (isSimulatedValue) {
        //   labelText = "Simulated " + labelText;
        // }

        if (
          isSimulatedValue &&
          isLastValue &&
          props.fund?.totalSimulatedNavCalculatedAtISO
        ) {
          // Use long datetime format with hour and minutes for the simulated value.
          formattedDate = formatDateLong(
            new Date(props.fund?.totalSimulatedNavCalculatedAtISO),
          );
        }

        const navRow =
          navUpdateIndex != null && appSettingsStore.isManageMode
            ? `
      <div class="tooltip_row">
        <div class="label">NAV Update:</div>
        #${navUpdateIndex}
      </div>
    `
            : "";

        return `
          <div class="custom_tooltip">
            <div class="tooltip_row">
              <div class="label">${labelText}:</div>
              ${selectedType.value === ChartType.NAV ? fundStore.getFormattedBaseTokenValue(valueNav) : abbreviateNumber(valueSharePrice, 3)}
            </div>
            ${navRow}
            <div class="tooltip_row">
              ${formattedDate}
            </div>
          </div>
        `;
      },
    },
  };
});

// Methods
const getSharePricePerNav = async () => {
  areBackendNavUpdatesLoading.value = true;

  // 1. get average block time for the chain
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(
    props.fund.chainId,
    false,
  );
  const averageBlockTime = blockTimeContext?.averageBlockTime || 0;

  sharePriceItemsFromChain.value = await Promise.all(
    fundNavUpdates.value?.map(
      async (navUpdate: INAVUpdate | ParsedNavUpdateDto) => {
        // 2. get block number for the timestamp
        const totalNav = ethers.parseUnits(
          String(navUpdate.totalNAV || "0"),
          props.fund?.baseToken.decimals,
        );
        const blockNumber = Number(
          (await blockTimeStore.getBlockByTimestamp(
            props.fund.chainId,
            navUpdate.timestamp / 1000,
            averageBlockTime,
          )) || 0,
        );

        try {
          const totalSupplyRaw = await web3Store.callWithRetry(
            props.fund.chainId,
            () => {
              const fundTokenContract = web3Store.getCustomContract(
                props.fund.chainId,
                ERC20,
                props.fund.fundToken.address,
              );

              return fundTokenContract.methods
                .totalSupply()
                .call({}, blockNumber);
            },
          );

          const totalSupply = ethers.parseUnits(
            String(totalSupplyRaw || "0"),
            props.fund.fundToken.decimals,
          );

          // Determine the highest decimals between NAV and Supply
          const navDecimals = props.fund.baseToken.decimals;
          const supplyDecimals = props.fund.fundToken.decimals;
          const diffDecimals = navDecimals - supplyDecimals;

          // Scale totalNav to the same decimals as totalSupply for proper division
          const adjustedTotalNav =
            diffDecimals < 0
              ? totalNav * 10n ** BigInt(-diffDecimals)
              : totalNav;
          const adjustedTotalSupply =
            diffDecimals > 0
              ? totalSupply * 10n ** BigInt(diffDecimals)
              : totalSupply;

          // Perform the division
          const scaleFactor = 10n ** 36n; // Scale up before division to avoid rounding errors
          const sharePriceBigInt =
            totalSupply > 0n
              ? (adjustedTotalNav * scaleFactor) / adjustedTotalSupply
              : 0n;

          // Convert to float and format the share price correctly
          return parseFloat(ethers.formatUnits(sharePriceBigInt, 36));
        } catch (e) {
          console.error("Error getting share price", e);
          return 0;
        }
      },
    ),
  );
  areBackendNavUpdatesLoading.value = false;
};

const getNavUpdates = () => {
  areBackendNavUpdatesLoading.value = true;

  fetchFundNavUpdatesAction(props.fund.chainId, props.fund.address)
    .then((navUpdates: ParsedNavUpdateDto[]) => {
      navUpdatesFromBackend.value = navUpdates;
      console.warn(
        "TTT fetchFundNavUpdatesAction ",
        props.fund.chainId,
        props.fund.address,
        navUpdates,
      );
      areBackendNavUpdatesLoading.value = false;
    })
    .catch((error) => {
      console.error(
        `Failed fetchFundNavUpdatesAction for ${props.fund.address}`,
        error,
      );
      areBackendNavUpdatesLoading.value = false;
      getSharePricePerNav();
    });
};

// Lifecycle
watch(
  () => fundStore?.fund?.address,
  () => {
    // TODO: Could do this and use only this, is much faster, but gets synced only every 5 minutes.
    // watch: fundStore?.fund?.address
    if (!fundStore?.fund?.address) return;
    getNavUpdates();
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  min-width: 100%;

  &__toolbar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  &__chart_wrapper {
    height: 370px;
    min-height: 370px;
  }
  ::v-deep(.custom_tooltip) {
    display: flex;
    padding: 0.75rem;
    flex-direction: column;
    justify-content: center;
    opacity: 1;
    gap: 0.5rem;
    line-height: 1;
    background: #1d212d;
    font-size: $text-sm;
    font-weight: 500;
    @include borderGray("border", true, rgba(255, 255, 255, 0.11));
    border-width: 2px;
    //box-shadow: 4px 46px 16px 0 rgba(31, 95, 255, 0.16);

    .tooltip_row {
      display: flex;
      flex-direction: row;
    }
    .label {
      padding-right: 0.5rem;
    }
  }
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/fund/settlement/Deposit.vue"
mkdir -p "components/fund/settlement"
cat > "components/fund/settlement/Deposit.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<template>
  <div style="width: 100%">
    <template v-if="!hasRequestedDeposit">
      <FundSettlementBaseForm
        v-if="fund"
        v-model="tokenValue"
        :token0="fund.baseToken"
        :token1="fund.fundToken"
        :token0-user-balance="fundStore.fundUserData.baseTokenBalance"
        :token1-user-balance="fundStore.fundUserData.fundTokenBalance"
        :exchange-rate="calculatedExchangeRate"
      />
    </template>
    <div v-else class="deposit-flow" @click="handleDepositClick">
      <h3 class="title">
        Deposit in progress:
      </h3>

      <div v-for="(step, index) in stepsDeposit" :key="index">
        <v-tooltip
          :disabled="!step.isDisabled"
          activator="parent"
          location="top"
        >
          <template #default>
            {{ step.tooltip }}
          </template>
          <template #activator="{ props }">
            <div v-bind="props">
              <div
                :key="index"
                class="step"
                :class="{ 'is_disabled': step.isDisabled }"
              >
                <span class="label">
                  {{ step.label }}
                </span>
                <Icon
                  v-if="step.done && !step.isDisabled"
                  icon="material-symbols:done"
                  class="text-success me-2"
                  height="1.2rem"
                  width="1.2rem"
                />
                <v-progress-circular
                  v-if="step.loading"
                  class="d-flex ms-2"
                  size="20"
                  width="3"
                  indeterminate
                />
              </div>
            </div>
          </template>
        </v-tooltip>
      </div>
    </div>

    <div v-if="accountStore.isConnected" style="width: 100%">
      <div
        class="buttons_group"
      >
        <v-tooltip
          :disabled="fundStore.isUserWalletWhitelisted"
          location="bottom"
        >
          <template #default>
            Your wallet address is not whitelisted to allow deposits into this vault.
          </template>
          <template #activator="{ props }">
            <span v-bind="props">
              <v-btn
                class="button_deposit button"
                variant="outlined"
                :disabled="isDepositButtonDisabled"
                @click="handleDepositClick"
              >
                {{ hasRequestedDeposit ? 'Continue Deposit' : 'Deposit' }}
              </v-btn>
            </span>
          </template>
        </v-tooltip>
      </div>

      <div
        v-if="visibleErrorMessages && tokenValueChanged"
        class="text-red mt-4 text-center"
      >
        <div v-for="(error, index) in visibleErrorMessages" :key="index">
          {{ error.message }}
        </div>
      </div>


      <ProcessDepositModal
        v-model="isDepositModalOpen"
        :token-value="tokenValue"
        :token-value-changed="tokenValueChanged"
        :visible-error-messages="visibleErrorMessages"
        @update:token-value="tokenValue = $event"
        @deposit-success="$emit('deposit-success')"
      />

    </div>
    <template v-else>
      <v-btn
        class="bg-primary text-secondary button_connect_wallet"
        @click="accountStore.connectWallet()"
      >
        Connect Wallet
      </v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFormError from "~/types/form_error";
import ProcessDepositModal from "~/components/fund/settlement/ProcessDepositModal.vue";

const emit = defineEmits(["deposit-success"]);
const toastStore = useToastStore();
const accountStore = useAccountStore();
const fundStore = useFundStore();

const tokenValue = ref("");
const tokenValueChanged = ref(false);
const fund = computed(() => fundStore.fund);
const {
  shouldUserWaitSettlementOrCancelDeposit,
  userDepositRequest,
  userDepositRequestExists,
} = storeToRefs(fundStore);

const loadingRequestDeposit = ref(false);
const loadingApproveAllowance = ref(false);
const isLoadingDelegate = ref(false);
const isLoadingProcessDeposit = ref(false);

const isDepositModalOpen = ref(false);

watch(
  () => tokenValue.value,
  () => {
    tokenValueChanged.value = true;
  },
);

const rules = [
  (value: string): boolean | IFormError => {
    if (!fund.value) return { message: "Fund data is missing.", display: true };
    let valueWei;
    try {
      valueWei = ethers.parseUnits(value, fund.value?.baseToken.decimals);
    } catch {
      return {
        message: `Make sure the value has max ${fund.value?.baseToken.decimals} decimals.`,
        display: false,
      };
    }
    if (valueWei <= 0)
      return { message: "Value must be positive.", display: false };

    console.log(
      "[DEPOSIT] check user base token balance wei: ",
      valueWei,
      fundStore.fundUserData.baseTokenBalance,
    );
    // This condition is only valid for Request Deposit, we don't check this condition for Approve.
    if (
      !userDepositRequestExists.value &&
      fundStore.fundUserData.baseTokenBalance < valueWei
    ) {
      const userBaseTokenBalanceFormatted = formatTokenValue(
        fundStore.fundUserData.baseTokenBalance,
        fund.value.baseToken.decimals,
      );
      return {
        message: `Your ${fund.value.baseToken.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`,
        display: true,
      };
    }
    return true;
  },
];

const depositRequestAmountFormatted = computed(() => {
  const baseToken = fundStore.fund?.baseToken;
  if (!userDepositRequest?.value?.amount || !baseToken) return "N/A";
  return formatTokenValue(
    userDepositRequest?.value?.amount,
    baseToken.decimals,
    false,
  );
});

const calculatedExchangeRate = computed(() => {
  return fundStore.baseToFundTokenExchangeRateSimulatedNav || fundStore.baseToFundTokenExchangeRateLastNavUpdate
});

const errorMessages = computed<IFormError[]>(() => {
  // Disable deposit button if any of rules is false.
  return rules
    .map((rule) => rule(tokenValue.value || "0"))
    .filter((rule) => rule !== true) as IFormError[];
});
const visibleErrorMessages = computed<IFormError[]>(() => {
  return errorMessages.value.filter((error: IFormError) => error.display);
});
const tokensWei = computed(() => {
  if (!fund.value?.baseToken) return 0n;
  return ethers.parseUnits(
    tokenValue.value || "0",
    fund.value?.baseToken.decimals,
  );
});

const handleError = (error: any, refreshData: boolean = true) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  loadingRequestDeposit.value = false;
  loadingApproveAllowance.value = false;
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.");
  } else {
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
    console.error(error);
    if (refreshData) {
      fundStore.fetchUserFundData(
        fundStore.selectedFundChain,
        fundStore.selectedFundAddress,
      );
    }
  }
};

/**
 * Sending a transaction and listening to the events.
 * https://docs.web3js.org/guides/wallet/transactions#sending-a-transaction-and-listening-to-the-events
 */
const requestDeposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to request deposit.");
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.");
    return;
  }
  console.log("REQUEST DEPOSIT");
  loadingRequestDeposit.value = true;

  console.log(
    "Request deposit tokensWei: ",
    tokensWei.value,
    "from : ",
    fundStore.activeAccountAddress,
  );

  const encodedFunctionCall = encodeFundFlowsCallFunctionData(
    "requestDeposit",
    [tokensWei.value],
  );
  console.log(
    "isConnectedWalletUsingLedger:",
    accountStore.isConnectedWalletUsingLedger,
  );
  console.log("contract:", fundStore.fundContract);
  console.warn("connectedWallet", accountStore?.connectedWallet);

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: ", hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);

        if (receipt.status) {
          toastStore.successToast("Your deposit request was successful.");
          // Set form token value to user's current balance + current deposit request value so that
          // he can approve it without inputting the value himself, for better UX.
          // TODO takes 15-20 sec for node to sync .. fix
          // await fundStore.fetchUserBalances();
          fundStore.fundUserData.depositRequest = {
            amount: tokensWei.value,
            timestamp: Date.now(),
            type: FundTransactionType.Deposit,
          };

          // deposit-success event is emitted to open the delegate dialog.
          emit("deposit-success");
        } else {
          toastStore.errorToast(
            "Your deposit request has failed. Please contact the Rethink Finance support.",
          );
          fundStore.fetchUserFundData(
            fundStore.selectedFundChain,
            fundStore.selectedFundAddress,
          );
        }
        loadingRequestDeposit.value = false;
      })
      .on("error", (error: any) => {
        handleError(error, false);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const processDeposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the vault.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("Vault data is missing.")
    return;
  }
  if (!userDepositRequest?.value?.amount) {
    toastStore.errorToast("Deposit request data is missing.");
    return;
  }
  console.log(
    "DEPOSIT tokensWei: ",
    userDepositRequest?.value?.amount,
    "from : ",
    fundStore.activeAccountAddress,
  );
  isLoadingProcessDeposit.value = true;
  const encodedFunctionCall = encodeFundFlowsCallFunctionData("deposit");

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        // Refresh user balances & allowance & refresh pending requests.
        fundStore.fetchUserFundData(
          fundStore.selectedFundChain,
          fundStore.selectedFundAddress,
        );

        if (receipt.status) {
          toastStore.successToast("Your deposit was successful.");
          isDepositModalOpen.value = false;

          // emit event to open the delegate votes modal
          emit("deposit-success");
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }

        isLoadingProcessDeposit.value = false;
      })
      .on("error", (error: any) => {
        isLoadingProcessDeposit.value = false;
        console.error(error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    isLoadingProcessDeposit.value = false;
    handleError(error);
  }
};

const setTokenValueToDepositRequestAmount = () => {
  tokenValue.value = depositRequestAmountFormatted.value;
};

const approveAllowance = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to approve allowance.");
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.");
    return;
  }
  console.log("APPROVE ALLOWANCE");
  loadingApproveAllowance.value = true;

  setTokenValueToDepositRequestAmount();

  console.log(
    "Approve allowance tokensWei: ",
    tokensWei.value,
    "from : ",
    fundStore.activeAccountAddress,
  );
  const allowanceValue = tokensWei.value;

  try {
    // call the approval method
    await fundStore.fundBaseTokenContract
      .send("approve", {}, fund.value?.address, tokensWei.value)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);

        if (receipt.status) {
          toastStore.successToast(
            "The approval was successful. You can make the deposit now.",
          );

          // Refresh allowance value.
          fundStore.fundUserData.fundAllowance = allowanceValue;
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }
        loadingApproveAllowance.value = false;
      })
      .on("error", (error: any) => {
        handleError(error, false);
      });
  } catch (error: any) {
    handleError(error);
  }
};


const hasRequestedDeposit = computed(() => {
  return !!fundStore.fundUserData.depositRequest?.timestamp
});

const hasApprovedAmount = computed(() => {
  if (!fundStore.fundUserData?.fundAllowance) return false;
  if (!fundStore.fundUserData?.depositRequest?.amount) return false;

  return fundStore.fundUserData?.fundAllowance >= fundStore.fundUserData?.depositRequest?.amount && hasRequestedDeposit.value;
});

const hasDelegatedToSelf = computed(() => {
  if (!fundStore.fundUserData.fundDelegateAddress) return false;
  if (!fundStore.activeAccountAddress) return false;

  return fundStore.fundUserData.fundDelegateAddress.toLowerCase() === fundStore.activeAccountAddress.toLowerCase();
});

const hasProcessedDeposit = computed(() => {
  return false;
  // return fundStore.fundUserData.depositRequestProcessed;
});

const stepsDeposit = computed(() => [
  {
    label: "1. Request Deposit",
    done: hasRequestedDeposit.value,
    loading: loadingRequestDeposit.value,
    isDisabled: false,
  },
  {
    label: "2. Approve Amount",
    done: hasApprovedAmount.value,
    loading: loadingApproveAllowance.value,
    isDisabled: false,
  },
  {
    label: "3. Delegate to Myself",
    done: hasDelegatedToSelf.value && hasApprovedAmount.value,
    loading: isLoadingDelegate.value,
  },
  {
    label: "4. Process Deposit",
    done: hasProcessedDeposit.value,
    isDisabled: shouldUserWaitSettlementOrCancelDeposit.value && hasDelegatedToSelf.value,
    tooltip: "Wait for the next NAV update to process the deposit.",
  },
]);

const handleDepositClick = () =>{
  if(!hasRequestedDeposit.value){
    requestDeposit();
  }
  isDepositModalOpen.value = true;
}


const isDepositButtonDisabled = computed(() => {
  return (
    (!hasRequestedDeposit.value && errorMessages.value.length > 0) ||
    !fundStore.isUserWalletWhitelisted
  );
});

const delegateToMyself = async () => {
  try {
    isLoadingDelegate.value = true;

    const delegateTo = fundStore.activeAccountAddress
    const governanceTokenAddress = fundStore.fund?.governanceToken.address;
    const fundAddress = fundStore.fund?.address;

    if (fundAddress === ethers.ZeroAddress) {
      toastStore.errorToast(
        "The vault address is not available. Please contact the Rethink Finance support.",
      );
      return;
    }

    let contract = fundStore.fundContract;

    if (
      governanceTokenAddress !== fundAddress &&
      governanceTokenAddress !== ethers.ZeroAddress
    ) {
      // external gov token
      contract = fundStore.fundGovernanceTokenContract;
    }

    await contract
      .send("delegate", {}, delegateTo)
      .on("transactionHash", function (hash: any) {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", function (receipt: any) {
        console.log(receipt);
        if (receipt.status) {
          toastStore.successToast(
            "Delegation of Governance Tokens Succeeded",
          );

          if (delegateTo) fundStore.fundUserData.fundDelegateAddress = delegateTo;
        } else {
          toastStore.errorToast(
            "The delegateTo tx has failed. Please contact the Rethink Finance support.",
          );
        }
        isLoadingDelegate.value = false;
      })
      .on("error", function (error: any) {
        console.error(error);
        isLoadingDelegate.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      })
  } catch (error) {
    console.error("Error delegating to external gov token: ", error);
    isLoadingDelegate.value = false;
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
  }
};

</script>

<style lang="scss" scoped>
.buttons_group {
  gap: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;

  .button {
    color: $color-primary !important;
    border-color: $color-primary !important;

    &:hover {
      background: $color-primary !important;
      color: $color-white !important;
      border-color: $color-primary !important;
    }
  }
}
.set_approve_allowance_button {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.divider {
  margin: 1rem auto;
  height: 0.1px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08)
}

.title {
  margin: 0 0 0.5rem;
}
.step {
  display: flex;
  align-items: center;
  margin: 0.25rem 0;
  width: fit-content;

  &.is_disabled {
    opacity: 0.5;
  }
}
.button_deposit {
  display: block;
  margin: 0 auto;
}
.button_connect_wallet{
  display: block;
  margin: 0 auto;
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo "  -> components/fund/settlement/Redeem.vue"
mkdir -p "components/fund/settlement"
cat > "components/fund/settlement/Redeem.vue" <<'__RETHINK_COLOR_PATCH_EOF__'
<template>
  <div style="width: 100%">
    <FundSettlementBaseForm
      v-if="fund"
      v-model="tokenValue"
      :token0="fund.fundToken"
      :token1="fund.baseToken"
      :token0-user-balance="fundStore.fundUserData.fundTokenBalance"
      :token1-user-balance="fundStore.fundUserData.baseTokenBalance"
      :exchange-rate="calculatedExchangeRate"
      :is-exchange-rate-loading="isLoadingFetchFundNAVUpdatesActionState"
    />

    <div v-if="accountStore.isConnected">
      <div class="buttons_group">
        <template v-if="shouldUserWaitSettlementOrCancelRedemption">
          <h3>Wait for settlement or cancel the redemption request.</h3>
        </template>
        <template v-else-if="userRedemptionRequestExists">
          <h3>You can now process or cancel the redemption request.</h3>
        </template>
        <template v-for="button in buttons">
          <v-tooltip
            v-if="button.isVisible"
            :key="button.name"
            location="bottom"
            :disabled="!button.tooltipText"
            bottom
          >
            <template #default>
              {{ button.tooltipText }}
            </template>
            <template #activator="{ props }">
              <!-- Wrap it in the span to show the tooltip even if the button is disabled. -->
              <span v-bind="props">
                <v-btn
                  class="button"
                  :disabled="button.disabled"
                  variant="outlined"
                  @click="button.onClick"
                >
                  <template #prepend>
                    <v-progress-circular
                      v-if="button.loading"
                      class="d-flex"
                      size="20"
                      width="3"
                      indeterminate
                    />
                  </template>
                  {{ button.name }}
                </v-btn>
              </span>
            </template>
          </v-tooltip>
        </template>
      </div>
      <div
        v-if="visibleErrorMessages && tokenValueChanged"
        class="text-red mt-4 text-center"
      >
        <div v-for="(error, index) in visibleErrorMessages" :key="index">
          {{ error.message }}
        </div>
      </div>
    </div>
    <template v-else>
      <v-btn
        class="bg-primary text-secondary button_connect_wallet"
        @click="accountStore.connectWallet()"
      >
        Connect Wallet
      </v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFormError from "~/types/form_error";
import { ActionState } from "~/types/enums/action_state";
import { useActionStateStore } from "~/store/actionState.store";

const toastStore = useToastStore();
const accountStore = useAccountStore();
const actionStateStore = useActionStateStore();
const fundStore = useFundStore();
const tokenValue = ref("");
const tokenValueChanged = ref(false);
const fund = computed(() => fundStore.fund);

const loadingRequestRedeem = ref(false);
const loadingCancelRedeem = ref(false);
const loadingRedeem = ref(false);
const {
  shouldUserWaitSettlementOrCancelRedemption,
  userRedemptionRequestExists,
} = storeToRefs(fundStore);

watch(
  () => tokenValue.value,
  () => {
    tokenValueChanged.value = true;
  },
);

const isLoadingFetchFundNAVUpdatesActionState = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
});

const calculatedExchangeRate = computed(() => {
  return fundStore.fundToBaseTokenExchangeRateSimulatedNav || fundStore.fundToBaseTokenExchangeRateLastNavUpdate
});

const rules = [
  (value: string): boolean | IFormError => {
    if (!fund.value) return { message: "Fund data is missing.", display: true };
    let valueWei;
    try {
      valueWei = ethers.parseUnits(
        value || "0",
        fund.value?.fundToken.decimals,
      );
    } catch {
      return {
        message: `Make sure the value has max ${fund.value?.fundToken.decimals} decimals.`,
        display: false,
      };
    }
    if (valueWei <= 0)
      return { message: "Value must be positive.", display: false };

    console.log(
      "[REDEEM] check user fund token balance wei: ",
      valueWei,
      fundStore.fundUserData.fundTokenBalance,
    );
    if (fundStore.fundUserData.fundTokenBalance < valueWei) {
      const userFundTokenBalanceFormatted = formatTokenValue(
        fundStore.fundUserData.fundTokenBalance,
        fund.value.fundToken.decimals,
      );
      return {
        message: `Your ${fund.value.fundToken.symbol} balance is too low: ${userFundTokenBalanceFormatted}.`,
        display: true,
      };
    }
    return true;
  },
];

const isRequestRedeemDisabled = computed(() => {
  // Disable redeem button if any of rules is false.
  if (errorMessages.value.length > 0) {
    console.log("request redeem errors", errorMessages.value);
  }
  return (
    errorMessages.value.length > 0 ||
    loadingRequestRedeem.value ||
    !fundStore.isUserWalletWhitelisted
  );
});

const errorMessages = computed<IFormError[]>(() => {
  // Disable Redeem button if any of rules is false.
  return rules
    .map((rule) => rule(tokenValue.value || "0"))
    .filter((rule) => rule !== true) as IFormError[];
});
const visibleErrorMessages = computed<IFormError[]>(() => {
  return errorMessages.value.filter((error: IFormError) => error.display);
});

const handleError = (error: any, refreshData: boolean = true) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  loadingRequestRedeem.value = false;
  loadingCancelRedeem.value = false;
  loadingRedeem.value = false;
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Redeem transaction was rejected.");
  } else {
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
    console.error(error);
    if (refreshData) {
      fundStore.fetchUserFundData(
        fundStore.selectedFundChain,
        fundStore.selectedFundAddress,
      );
    }
  }
};

const requestRedemption = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the vault.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Vault data is missing.")
    return;
  }
  console.log("[REQUEST REDEMPTION]");
  loadingRequestRedeem.value = true;

  const tokensWei = ethers.parseUnits(
    tokenValue.value || "0",
    fund.value.fundToken.decimals,
  );
  console.log(
    "[REDEEM] tokensWei: ",
    tokensWei,
    "from : ",
    fundStore.activeAccountAddress,
  );
  const encodedFunctionCall = encodeFundFlowsCallFunctionData(
    "requestWithdraw",
    [tokensWei],
  );

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log(receipt);

        // TODO takes 15-20 sec for node to sync .. fix
        // fundStore.fetchUserFundDepositRedemptionRequests();
        if (receipt.status) {
          toastStore.successToast(
            "Your withdrawal request was successful. It may take 10 seconds or more for values to update.",
          );
          fundStore.fundUserData.redemptionRequest = {
            amount: tokensWei,
            timestamp: Date.now(),
            type: FundTransactionType.Redemption,
          };
          tokenValue.value = "";
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }

        loadingRequestRedeem.value = false;
      })
      .on("error", (error: any) => {
        handleError(error, false);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const buttons = ref([
  {
    name: "Request Redemption",
    onClick: requestRedemption,
    disabled: isRequestRedeemDisabled,
    loading: loadingRequestRedeem,
    isVisible: computed(() => !userRedemptionRequestExists.value),
    tooltipText: computed(() => {
      if (userRedemptionRequestExists.value) {
        return "Redemption request already exists. To change it, you first have to cancel the existing one.";
      }
      if (!fundStore.isUserWalletWhitelisted) {
        return "Your wallet address is not whitelisted to allow deposits into this vault."
      }
      return "";
    }),
  },
]);
</script>

<style lang="scss" scoped>
.buttons_group {
  gap: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;

  .button {
    color: $color-primary !important;
    border-color: $color-primary !important;

    &:hover {
      background: $color-primary !important;
      color: $color-white !important;
      border-color: $color-primary !important;
    }
  }
}

.divider{
  margin: 1rem auto;
  height: 0.1px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08)
}
.button_connect_wallet{
  display: block;
  margin: 0 auto;
}
</style>
__RETHINK_COLOR_PATCH_EOF__

echo ""
echo "Done. 9 files updated."
echo "Next:"
echo "  git status   # should list exactly these 9 files"
echo "  git diff     # every change should be a color value"
echo "  npm run dev  # smoke-test locally"
