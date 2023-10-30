<template>
  <div>
    <table
      class="rethink-table"
      :style="{ ...defaultStyle, background: bgColor, ...style }"
    >
      <caption :style="captionStyle">
        <div class="table-navbar-content">
          <slot name="table-navbar-content"></slot>
          <input
            v-if="isFilterable"
            v-model="filtering"
            @input="filterTable"
            placeholder="Search by name..."
          />
        </div>
      </caption>
      <thead v-if="showHeader">
        <tr :style="{ height }">
          <th
            v-for="column in table.columns"
            :key="column.id"
            :style="tableHeadDefaultStyle"
            @click="toggleSorting(column)"
            :colspan="column.colSpan"
          >
            <div class="table-header-cell">
              <span class="table-header-text">{{
                column.columnDef.header
              }}</span>
              <i
                v-if="isSortable && column.getIsSorted()"
                :class="{
                  'icon-arrow-down': column.getIsSorted() === 'desc',
                  'icon-arrow-up': column.getIsSorted() === 'asc',
                }"
              ></i>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in table.rows" :key="row.id" :style="{ height }">
          <td
            v-for="cell in row.cells"
            :key="cell.id"
            :style="{
              ...tableDataDefaultStyle,
              borderBottom: shouldShowBottomBorder(row),
            }"
            :data-cell="cell.column.columnDef.header"
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
            <!-- {{ cell.column.columnDef.cell(row.original) }} -->
          </td>
        </tr>
      </tbody>
      <tfoot>
        <!-- pagination logic here -->
      </tfoot>
    </table>
    <div class="rethink-pagination-container" :style="{ marginTop: '16px' }">
      <div class="rethink-pagination-actions">
        <button
          v-if="btnType === 'small'"
          :disabled="!table.canPreviousPage"
          @click="gotoPage(0)"
        >
          First Page
        </button>
        <button :disabled="!table.canPreviousPage" @click="previousPage">
          Previous Page
        </button>
        <button :disabled="!table.canNextPage" @click="nextPage">
          Next Page
        </button>
        <button
          v-if="btnType === 'tiny'"
          :disabled="!table.canNextPage"
          @click="gotoPage(table.pageCount - 1)"
        >
          Last Page
        </button>
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
  height: {
    type: String,
    default: "66px",
  },
  style: Object,
  className: String,
  captionSpacing: {
    type: String,
    default: "2rem",
  },
});

const filtering = ref("");
const defaultStyle = ref({
  padding: "1rem",
  borderCollapse: "collapse",
  background: "white",
  width: "100%",
});
const tableHeadDefaultStyle = ref({
  padding: ".1rem",
  paddingInline: "1rem",
  background: "transparent",
  borderBottom: "1px solid #F2F2F2",
});
const tableDataDefaultStyle = ref({
  padding: ".1rem",
  paddingInline: "1rem",
  background: "transparent",
});
const table = useVueTable(
  {
    columns: props.columns,
    data: props.data,
    // plugins: [useFlexLayout, useBlockLayout],
  },
  {
    getRowProps() {
      return { style: { height: props.height } };
    },
    getCellProps(cell) {
      return {
        style: {
          ...tableDataDefaultStyle.value,
          borderBottom:
            cell.row.index + 1 !== table.rows.length ? "1px solid #F2F2F2" : "",
        },
        "data-cell": cell.column.columnDef.header,
      };
    },
    getColumnProps(column) {
      return {
        style: tableHeadDefaultStyle.value,
        onClick: column.toggleSort,
      };
    },
  }
);

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

const shouldShowBottomBorder = (row) => {
  return row.index + 1 !== table.rows.length ? "1px solid #F2F2F2" : "";
};

const toggleSorting = (column) => {
  column.toggleSort();
};

const filterTable = (value) => {
  filtering.value = value;
};

const gotoPage = (pageIndex) => {
  table.gotoPage(pageIndex);
};

const previousPage = () => {
  table.previousPage();
};

const nextPage = () => {
  table.nextPage();
};

onMounted(() => {
  table.gotoPage(0);
});

watch([() => props.data, () => props.columns], () => {
  table.refresh();
});
</script>

<style scoped>
.rethink-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.rethink-table caption {
  caption-side: top;
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.rethink-table .table-navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rethink-table input[type="text"] {
  background: transparent;
  border: none;
  border-bottom: 1px solid #ccc;
  padding: 5px;
  width: 100%;
}

.rethink-table thead {
  background: transparent;
  border-bottom: 1px solid #f2f2f2;
}

.rethink-table th {
  padding: 0.1rem;
  padding-inline: 1rem;
  background: transparent;
}

.rethink-table .table-header-cell {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: space-between;
  text-align: start;
  padding-inline-end: 1rem;
}

.rethink-table .table-header-text {
  font-weight: 700;
  margin: 0;
  text-transform: uppercase;
}

.rethink-table i.icon-arrow-down {
  /* Define styles for the down arrow icon */
}

.rethink-table i.icon-arrow-up {
  /* Define styles for the up arrow icon */
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
