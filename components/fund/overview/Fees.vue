<template>
  <div class="main_grid main_grid--full-width">
    <UiDataRowCard
      :title="formatFee(fund?.managementFee)"
      subtitle="Management Fee"
      :title2="formatAddress(fund?.managementFeeAddress)"
      subtitle2="Distributed to"
      :title3="formatPeriod(fund?.managementPeriod)"
      subtitle3="Fee Period (Days)"
      class="main_grid__item"
    />
    <UiDataRowCard
      :title="formatFee(fund?.performanceFee)"
      subtitle="Performance Fee"
      :title2="formatAddress(fund?.performanceFeeAddress)"
      subtitle2="Distributed to"
      :grow-column2="true"
      :title3="formatPeriod(fund?.performancePeriod)"
      subtitle3="Fee Period (Days)"
      :title4="formatFee(fund.performaceHurdleRateBps)"
      subtitle4="Hurdle Rate"
      class="main_grid__item"
    />
    <UiDataRowCard
      :title="formatFee(fund?.depositFee)"
      subtitle="Deposit Fee"
      :title2="formatAddress(fund?.depositFeeAddress)"
      subtitle2="Distributed to"
      class="main_grid__item"
    />
    <UiDataRowCard
      :title="formatFee(fund?.withdrawFee)"
      subtitle="Exit Fee"
      :title2="formatAddress(fund?.withdrawFeeAddress)"
      subtitle2="Distributed to"
      class="main_grid__item"
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
    formatPeriod(period?: any) {
      if (period == 0) return "365";
      return JSON.stringify(period);
    },
    formatFee(feeBps?: any) {
      if (feeBps === undefined || feeBps === null) return "N/A";
      const feePercent = (Number(feeBps) / 100).toString();
      return `${feePercent}%`;
    },
    formatAddress(address?: string) {
      if (!address || isZeroAddress(address)) return "N/A";
      return address;
    },
  },
});
</script>

<style lang="scss" scoped>
.main_grid {
  &__item {
    :deep(.data_row__column) {
      &:first-child {
        min-width: 10rem;
      }
      &:nth-child(2) {
        flex-grow: unset;
      }
    }
  }
}
</style>
