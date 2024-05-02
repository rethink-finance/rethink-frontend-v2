<template>
  <div class="details main_grid main_grid--full-width">
    <template v-if="fund.navUpdates?.length > 0">

      <UiDataRowCard
        v-for="(navUpdate, index) in fund.navUpdates"
        :key="index"
        :title="navUpdate.date"
        :grow-column1="true"
        :title2="formatNAV(navUpdate.totalNAV)"
        :grow-column2="true"
      >
        <template #body>
          <div class="details__title">
            **NAV Liquid**
          </div>
          <div class="details__body">
            <!-- TODO -->
            <!--          {{ stringifyDetails(navUpdate.details.liquid) }}-->
            N/A
          </div>
          <div class="details__title">
            **NAV Illiquid**
          </div>
          <div class="details__body">
            <!-- TODO -->
            <!--          {{ stringifyDetails(navUpdate.details.illiquid) }}-->
            N/A
          </div>
        </template>
        <template #actionText="{ expanded }">
          {{ expanded ? "Close" : "Check" }} Details
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
  methods: {
    stringifyDetails(detailsJSON: string) {
      return JSON.stringify(JSON.parse(detailsJSON), null, 2)
    },
    formatNAV(value: bigint) {
      return formatTokenValue(value, this.fund.baseToken.decimals);
    },
  },
})
</script>

<style lang="scss" scoped>
.details {
  &__title {
    color: $color-primary;
    font-weight: 700;
  }
  &__body {
    font-family: monospace;
    white-space: pre;
    font-size: $text-sm;
    &:not(:last-of-type) {
      margin-bottom: 1.5rem;
    }
  }
}
</style>
