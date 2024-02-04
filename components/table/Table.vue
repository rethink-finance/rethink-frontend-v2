<template>
  <div style="width: 100%; padding-inline: 200px">
    <table
      class="rethink-table"
      :style="{ ...defaultStyle, background: bgColor, ...style }"
    >
      <caption v-if="showControls" :style="captionStyle">
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
            @click="toggleSorting(header)"
          >
            <div
              class="table-header-cell"
            >
              <FlexRender
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :style="{ height: rowHeight }"
          @click="$router.push(`/details/${row.original.id}`)"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :style="{
              ...tableDataDefaultStyle,
            }"
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
    <div class="rethink-pagination-container" :style="{ marginTop: '16px' }">
      <div class="rethink-pagination-actions d-flex" style="gap: 20px">
        <v-btn
          variant="text"
          :disabled="!table.canPreviousPage"
          @click="gotoPage(0)"
        >
          First Page
        </v-btn>
        <v-btn
          variant="text"
          :disabled="!table.canPreviousPage"
          @click="previousPage"
        >
          Previous Page
        </v-btn>
        <v-btn variant="text" :disabled="!table.canNextPage" @click="nextPage">
          Next Page
        </v-btn>
        <v-btn
          variant="text"
          :disabled="!table.canNextPage"
          @click="gotoPage(table.getPageCount() - 1)"
        >
          Last Page
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useVueTable, FlexRender, getCoreRowModel } from "@tanstack/vue-table";

const props = defineProps({
  captionSide: String,
  showControls: Boolean,
  columns: Array,
  data: Array,
  isPaginated: Boolean,
  isSortable: Boolean,
  isFilterable: Boolean,
  showHeader: {
    type: Boolean,
    default: true,
  },
  btnType: String,
  bgColor: {
    type: String,
    default: "transparent",
  },
  headerHeight: {
    type: String,
    default: "2.5rem",
  },
  rowHeight: {
    type: String,
    default: "3.5rem",
  },
  style: Object,
  className: String,
  captionSpacing: {
    type: String,
    default: "2rem",
  },
  getCellClass: {
    type: Function,
    default: () => {},
  },
});

const filtering = ref("");
const defaultStyle = ref({
  // padding: "1rem",
  borderCollapse: "collapse",
  width: "100%",
});
const tableHeadDefaultStyle = ref({
  // padding: ".1rem",
  // paddingInline: "2rem",
  borderBottom: "3px solid #111C35",
});
const tableDataDefaultStyle = ref({
  // padding: ".1rem",
  // paddingInline: "3rem",
});
const table = useVueTable({
  columns: props.columns ?? [],
  data: props.data ?? [],
  getCoreRowModel: getCoreRowModel(),
  defaultColumn: {
    minSize: 60,
    size: 70,
  },
});

const captionStyle = computed(() => {
  return {
    captionSide: props.captionSide,
    [`padding${
      props.captionSide === "top" || props.captionSide === "block-start"
        ? "-bottom"
        : props.captionSide === "inline-end"
          ? "-inline-end"
          : props.captionSide === "bottom" || props.captionSide === "block-end"
            ? "-top"
            : "-inline-start"
    }`]: props.captionSpacing,
  };
});

// const shouldShowBottomBorder = (row) => {
//   return row.index + 1 !== table.rows.length ? "1px solid #F2F2F2" : "";
// };

const getColumnWidth = (column) => {
  const styles = {};
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
const toggleSorting = (column) => {
  column.toggleSort();
};

const filterTable = (value) => {
  filtering.value = value;
};

const gotoPage = (pageIndex) => {
  table.setPageIndex(pageIndex);
};

const previousPage = () => {
  table.previousPage();
};

const nextPage = () => {
  table.nextPage();
};

onMounted(() => {
  table.setPageIndex(0);
});

watch([() => props.data, () => props.columns], () => {
  table.refresh();
});
</script>

<style lang="scss" scoped>
.rethink-table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  font-size: $text-sm;
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
    height: 2.5rem;
    th {
      background: $color-surface;
      color: $color-light-subtitle;
      font-weight: 500;
      letter-spacing: 0.02625rem;

      &:not(:first-child) .table-header-cell {
        justify-content: flex-end;
      }
      .table-header-cell {
        display: flex;
        gap: 5px;
        align-items: center;
        text-align: start;
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
      .td-cell {
        width: 100%;
        overflow: hidden;
        @include ellipsis;
      }
      &:hover {
        background: $color-gray-transparent;
      }
    }
  }
}

th {
  padding-inline: 1rem;
  background: #0c0d1229;
  /* background: transparent; */
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



.rethink-table .table-header-text {
  font-weight: 700;
  margin: 0;
  text-transform: uppercase;
}

.rethink-table tbody td {
  padding: 0.1rem;
  padding-inline: 1rem;
  background: transparent;
}

.rethink-table .rethink-pagination-container {
  margin-top: 16px;
}

.rethink-table .rethink-pagination-actions {
  display: flex;
  gap: 10px;
}

.rethink-table button {
  /* Define styles for the pagination buttons */
}
</style>
