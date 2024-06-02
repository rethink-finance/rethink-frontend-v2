<template>
  <v-data-table
    v-if="methods.length"
    v-model="selected"
    v-model:expanded="expanded"
    :headers="headers"
    :items="computedMethods"
    :cell-props="methodProps"
    class="main_table nav_entries"
    show-expand
    expand-on-click
    item-value="detailsHash"
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
      <UiPositionTypeBadge
        :value="value"
        :disabled="item.deleted || item.isAlreadyUsed"
      />
    </template>

    <template #[`item.data-table-expand`]="{ item, internalItem, isExpanded, toggleExpand }">
      <UiDetailsButton
        text="Details"
        :active="isExpanded(internalItem)"
        :disabled="item.deleted || item.isAlreadyUsed"
        @click.stop="toggleExpand(internalItem)"
      />
    </template>

    <template #[`item.data-table-select`]="{ item, internalItem, isSelected, toggleSelect }">
      <div v-if="item.isAlreadyUsed">
        <UiTextBadge value="In Use" :disabled="item.isAlreadyUsed" />
      </div>
      <v-checkbox-btn
        v-else
        :model-value="isSelected(internalItem)"
        @click.stop="toggleSelect(internalItem)"
      />
    </template>

    <template #[`item.delete`]="{ item }">
      <UiDetailsButton small @click.stop="deleteMethod(item)">
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
    // TODO prevent directly modifying passed methods and use computed() get & set for it
    methods: {
      type: Array as () => INAVMethod[],
      default: () => [],
    },
    // Optional prop of methods that are already being used.
    // If the "selectable" prop is true, these methods will be made unselectable and marked as "in-use".
    usedMethods: {
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
  emits: ["update:methods", "selectedChanged"],
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
    usedMethodHashes(): string[] {
      return this.usedMethods.map(method => method.detailsHash || "");
    },
    computedMethods() {
      return this.methods.map(method => ({
        ...method,
        isAlreadyUsed: this.isMethodAlreadyUsed(method.detailsHash),
      }));
    },
  },
  methods: {
    deleteMethod(method: INAVMethod) {
      // If method is new, we can just remove it from the methods array.
      // If it is not new, we will mark it as deleted.
      const methods = [...this.methods]; // Create a shallow copy of the array
      for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        if (m.detailsHash === method.detailsHash) {
          if (m.isNew) {
            // Remove the new method from the array
            methods.splice(i, 1);
            // Adjust the index to account for the removed item
            i--;
          } else {
            methods[i] = { ...m, deleted: !m.deleted }; // Toggle the deleted property
          }
        }
      }
      this.$emit("update:methods", methods);
    },
    methodProps(internalItem: any) {
      const props = {
        class: "",
      };
      // Parameter internalItem comes from vuetify data table.
      // And item is an actual INAVMethod.
      if (internalItem.item.deleted) {
        props.class +=  " tr_delete_method";
      } else if (internalItem.item.isNew) {
        props.class +=  " tr_is_new_method";
      }
      if (this.isMethodAlreadyUsed(internalItem.item?.detailsHash)) {
        props.class +=  " tr_method_already_used";
      }
      return props;
    },
    onSelectionChanged() {
      // Exclude already used.
      this.$emit("selectedChanged", this.selected.filter(detailsHash => !this.isMethodAlreadyUsed(detailsHash)))
    },
    isMethodAlreadyUsed(detailsHash?: string) {
      return this.usedMethodHashes.includes(detailsHash || "")
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
  :deep(.tr_method_already_used) {
    color: $color-disabled;
  }
  :deep(.tr_is_new_method) {
    .td_index {
      color: $color-success;
    }
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
