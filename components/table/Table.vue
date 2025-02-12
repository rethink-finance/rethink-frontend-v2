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
  borderBottom: "3px solid #111C35",
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
    border-bottom: 1px solid #ccc;
    padding: 5px;
    width: 100%;
  }
  thead {
   border-bottom: 1px solid #f2f2f2;
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
      outline: 2px solid #111c35;
      border-bottom: 2px solid #213566;
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
