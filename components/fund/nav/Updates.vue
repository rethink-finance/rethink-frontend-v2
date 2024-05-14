<template>
  <div class="details main_grid main_grid--full-width">
    <template v-if="fund.navUpdates?.length > 0">

      <!-- TODO fix title when NAV update timestamps become available -->
      <UiDataRowCard
        v-for="(navUpdate, index) in fund.navUpdates"
        :key="index"
        :title="'#' + (Number(navUpdate.date) + 1)"
        :grow-column1="true"
        :title2="formatNAV(navUpdate.totalNAV)"
        :grow-column2="true"
        no-body-padding
      >
        <template #body>
          <!-- TODO create entries, use Table.vue for this also
              check: https://vuetifyjs.com/en/components/data-tables/basics/
          -->
          <v-data-table
            :expanded="expanded"
            :headers="headers"
            :items="navUpdate.entries"
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
                <td :colspan="columns.length">
                  <div class="details__body">
                    <div class="details__json">
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
        </template>
        <template #actionText="{ expanded }">
          {{ expanded ? "Close" : "See" }} Details
        </template>
      </UiDataRowCard>
    </template>

    <template v-else>
      There are currently no NAV updates.
    </template>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default defineComponent({
  name: "NAVUpdates",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
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
  methods: {
    formatNAV(value: bigint) {
      return formatTokenValue(value, this.fund.baseToken.decimals) + " " + this.fund.baseToken.symbol;
    },
  },
})
</script>

<style lang="scss" scoped>
.details {
  &__body {
    @include borderGray;
    font-family: monospace;
    white-space: pre;
    font-size: $text-sm;
    padding: 1rem 7.1rem;
    background-color: $color-card-background;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
  &__json{
    background-color: $color-card-background;
    padding: 1.5rem;
    color: $color-primary;
  }
}
</style>
