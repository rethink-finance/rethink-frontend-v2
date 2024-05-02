<template>
  <div class="main_grid main_grid--full-width">
    <UiDataRowCard
      :title="managementFee"
      subtitle="Management Fee"
      :title2="managementFeeAddress"
      subtitle2="Distributed to"
      :grow-column2="true"
      :title3="hurdleRate"
      subtitle3="Hurdle Rate"
    />
    <UiDataRowCard :title="fund.governanceToken?.address" subtitle="Governance Token" />
  </div>
</template>

<script lang="ts">

import type IFund from "~/types/fund";

export default defineComponent({
  name: "Fees",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  computed: {
    managementFee() {
      return `${this.fund.managementFee}%`;
    },
    managementFeeAddress() {
      return this.fund.managementFeeAddress || "N/A";
    },
    hurdleRate() {
      if (!this.fund.performaceHurdleRateBps) return "N/A";
      return `${this.fund.performaceHurdleRateBps} BPS`;
    },
  },
})
</script>

<style lang="scss" scoped>
</style>
