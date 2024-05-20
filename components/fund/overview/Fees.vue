<template>
  <div class="main_grid main_grid--full-width">
    <UiDataRowCard
      :title="formatFee(fund?.managementFee)"
      subtitle="Management Fee"
      :title2="formatAddress(fund?.managementFeeAddress)"
      subtitle2="Distributed to"
    />
    <UiDataRowCard
      :title="formatFee(fund?.performanceFee)"
      subtitle="Performance Fee"
      :title2="formatAddress(fund?.performanceFeeAddress)"
      subtitle2="Distributed to"
      :grow-column2="true"
      :title3="formatFee(fund.performaceHurdleRateBps)"
      subtitle3="Hurdle Rate"
    />
    <UiDataRowCard
      :title="formatFee(fund?.depositFee)"
      subtitle="Deposit Fee"
      :title2="formatAddress(fund?.depositFeeAddress)"
      subtitle2="Distributed to"
    />
    <UiDataRowCard
      :title="formatFee(fund?.withdrawFee)"
      subtitle="Exit Fee"
      :title2="formatAddress(fund?.withdrawFeeAddress)"
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
  methods: {
    formatFee(feeBps?: any) {
      if (feeBps === undefined || feeBps === null) return "N/A";
      const feePercent = (Number(feeBps) / 100).toString();
      return `${feePercent}%`;
    },
    formatAddress(address?: string) {
      if (!address || isZeroAddress(address)) return "N/A"
      return address;
    },
  },
})
</script>

<style lang="scss" scoped>
</style>
