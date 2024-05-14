<template>
  <v-data-table
    v-if="methods.length"
    :expanded="expanded"
    :headers="headers"
    :items="methods"
    class="main_table nav_entries"
    show-expand
  >
    <template #[`item.index`]="{ index }">
      <strong>{{ index + 1 }}</strong>
    </template>
    <template #[`item.positionType`]="{ value }">
      <UiPositionTypeBadge :value="value" />
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
  },
  data: () => ({
    expanded: [],
    headers: [
      { title: "#", key: "index", sortable: false },
      { title: "Position Name", key: "positionName", sortable: false },
      { title: "Valuation Source", key: "valuationSource", sortable: false },
      { title: "Position Type", key: "positionType", sortable: false },
      { key: "details", sortable: false },
    ],
  }),
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
  &__button {
    @include borderGray;
    padding: 0.5rem 1rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    font-size: $text-xs;
    font-weight: 500;
    color: $color-text-irrelevant;

    &--text_expanded{
      font-weight: 700;
      color: $color-white;
    }
    &__expanded{
      background-color: $color-background-button;
    }
  }
  &__button_icon {
    margin-left: 0.5rem;
  }
}
</style>
