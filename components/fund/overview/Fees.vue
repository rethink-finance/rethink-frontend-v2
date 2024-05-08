<template>
  <div class="main_grid main_grid--full-width">
    <UiDataRowCard
      :title="formatFee(fund?.managementFee)"
      subtitle="Management Fee"
      :title2="fund?.managementFeeAddress || 'N/A'"
      subtitle2="Distributed to"
    />
    <UiDataRowCard
      :title="formatFee(fund?.performanceFee)"
      subtitle="Performance Fee"
      :title2="fund?.performanceFeeAddress || 'N/A'"
      subtitle2="Distributed to"
      :grow-column2="true"
      :title3="performanceHurdleRate"
      subtitle3="Hurdle Rate"
    />
    <UiDataRowCard
      :title="formatFee(fund?.depositFee)"
      subtitle="Deposit Fee"
      :title2="fund?.depositFeeAddress || 'N/A'"
      subtitle2="Distributed to"
    />
    <UiDataRowCard
      :title="formatFee(fund?.withdrawFee)"
      subtitle="Exit Fee"
      :title2="fund?.withdrawFeeAddress || 'N/A'"
      subtitle2="Distributed to"
    />
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
    performanceHurdleRate() {
      if (!this.fund.performaceHurdleRateBps) return "N/A";
      return `${this.fund.performaceHurdleRateBps} BPS`;
    },
  },
  methods: {
    formatFee(feeBps?: any) {
      if (feeBps === undefined || feeBps === null) return "N/A";
      const feePercent = (Number(feeBps) / 100).toString();
      return `${feePercent}%`;
    },
  },
})
</script>

<style lang="scss" scoped>
</style>
