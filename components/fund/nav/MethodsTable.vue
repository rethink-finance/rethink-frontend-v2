<template>
  <v-data-table
    v-if="methods.length"
    v-model="selected"
    v-model:expanded="expanded"
    :headers="headers"
    :items="methods"
    :cell-props="methodProps"
    class="main_table nav_entries"
    show-expand
    expand-on-click
    return-object
    :show-select="selectable"
    @input="onSelectionChanged"
  >
    <template #[`item.index`]="{ index }">
      <strong class="td_index">{{ index + 1 }}</strong>
    </template>

    <template #[`item.positionName`]="{ value }">
      {{ value ?? "N/A" }}
    </template>

    <template #[`item.valuationSource`]="{ value }">
      {{ value ?? "N/A" }}
    </template>

    <template #[`item.positionType`]="{ value, item }">
      <UiPositionTypeBadge :value="value" :disabled="item.deleted" />
    </template>

    <template #[`item.data-table-expand`]="{ item, internalItem, isExpanded, toggleExpand }">
      <UiDetailsButton
        text="Details"
        :active="isExpanded(internalItem)"
        :disabled="item.deleted"
        @click.stop="toggleExpand(internalItem)"
      />
    </template>

    <template #[`item.delete`]="{ item }">
      <UiDetailsButton small @click.stop="toggleDeleteMethod(item)">
        <v-icon
          v-if="item.deleted"
          icon="mdi-arrow-u-left-top"
          color="secondary"
        />
        <v-icon
          v-else
          icon="mdi-delete"
          color="error"
        />
      </UiDetailsButton>
    </template>

    <template #expanded-row="{ columns, item }">
      <tr class="tr_row_expanded" :class="{'tr_delete_method': item.deleted }">
        <td :colspan="columns.length" class="pa-0">
          <div class="nav_entries__details">
            <div class="nav_entries__json">
              {{ item.detailsJson }}
            </div>
          </div>
        </td>
      </tr>
    </template>

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="nav_entries__no_data">
    No NAV details available.
  </div>
</template>

<script lang="ts">
import type INAVMethod from "~/types/nav_method";


export default defineComponent({
  name: "NAVMethods",
  props: {
    methods: {
      type: Array as () => INAVMethod[],
      default: () => [],
    },
    deletable: {
      type: Boolean,
      default: false,
    },
    selectable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["selectedChanged"],
  data: () => ({
    expanded: [],
    selected: [],
  }),
  computed: {
    headers() {
      // Check:
      // https://vuetifyjs.com/en/api/v-data-table/#props-header-props
      const headers: any[] = [
        { title: "#", key: "index", sortable: false },
        { title: "Position Name", key: "positionName", sortable: false },
        { title: "Valuation Source", key: "valuationSource", sortable: false },
        { title: "Position Type", key: "positionType", sortable: false },
        { key: "data-table-expand", sortable: false, align: "center" },
      ];
      if (this.deletable) {
        headers.push({ key: "delete", sortable: false, align: "center", width: "40px" })
      }
      if (this.selectable) {
        headers.push({ key: "data-table-select", sortable: false, align: "center", width: "40px" })
      }

      return headers;
    },
  },
  methods: {
    toggleDeleteMethod(method: INAVMethod) {
      // TODO: this is not the best, as we modify the provided prop, we shouldn't mutate props like that.
      method.deleted = !method.deleted;
    },
    methodProps(method: any) {
      if (method.item.deleted) {
        return { class: "tr_delete_method" }
      }
    },
    onSelectionChanged() {
      console.log("data: ", this.selected);
      this.$emit("selectedChanged", this.selected)
    },
  },
})
</script>

<style lang="scss" scoped>
.nav_entries {
  &__details {
    font-family: monospace;
    white-space: pre;
    font-size: $text-sm;
    padding: 1rem 7.1rem;
    background-color: $color-badge-navy;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
  &__json{
    @include borderGray;
    background-color: $color-card-background;
    padding: 1.5rem;
    color: $color-primary;
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }
  :deep(.tr_delete_method) {
    color: $color-disabled;

    .nav_entries__json{
      color: $color-disabled;
    }
    .td_index {
      color: $color-error;
    }
  }
}

</style>
