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
      >
        <template #body>
          <div class="details__title">
            NAV Liquid
          </div>
          <div class="details__body">
            {{ navUpdate.json?.liquid || "N/A" }}
          </div>
          <div class="details__title">
            NAV Illiquid
          </div>
          <div class="details__body">
            {{ navUpdate.json?.illiquid || "N/A" }}
          </div>
          <div class="details__title">
            NAV Composable
          </div>
          <div class="details__body">
            {{ navUpdate.json?.composable || "N/A" }}
          </div>
          <div class="details__title">
            NAV NFT
          </div>
          <div class="details__body">
            {{ navUpdate.json?.nft || "N/A" }}
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
      return formatTokenValue(value, this.fund.baseToken.decimals) + " " + this.fund.baseToken.symbol;
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
