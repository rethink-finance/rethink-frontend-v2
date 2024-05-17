<template>
  <v-data-table
    v-if="methods.length"
    :expanded="expanded"
    :headers="headers"
    :items="methods"
    class="main_table nav_entries"
    show-expand
    expand-on-click
  >
    <template #[`item.index`]="{ index }">
      <strong>{{ index + 1 }}</strong>
    </template>

    <template #[`item.positionName`]="{ value }">
      {{ value ?? "N/A" }}
    </template>

    <template #[`item.valuationSource`]="{ value }">
      {{ value ?? "N/A" }}
    </template>

    <template #[`item.positionType`]="{ value }">
      <UiPositionTypeBadge :value="value" />
    </template>

    <template #[`item.data-table-expand`]="{ internalItem, isExpanded }">
      <UiDetailsButton :active="isExpanded(internalItem)" />
    </template>

    <template #[`item.delete`]>
      <v-btn variant="plain">
        <v-icon icon="mdi-delete" color="error" />
      </v-btn>
    </template>

    <template #expanded-row="{ columns, item }">
      <tr>
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
  },
  data: () => ({
    expanded: [],
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

      return headers;
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
}
</style>
