<template>
  <div class="main_grid main_grid--full-width">
    <UiDataRowCard
      :title="formatFee(fund?.managementFee)"
      subtitle="Management Fee"
      subtitle2="Distributed to"
      :title3="formatPeriod(fund?.managementPeriod)"
      subtitle3="Fee Period (Days)"
      class="main_grid__item"
    >
      <template #title2>
        <AddressLink
          v-if="fund?.managementFeeAddress && !isZeroAddress(fund.managementFeeAddress)"
          :address="fund.managementFeeAddress"
          :chain-id="fund.chainId"
        />
        <span v-else>N/A</span>
      </template>
    </UiDataRowCard>
    <UiDataRowCard
      :title="formatFee(fund?.performanceFee)"
      subtitle="Performance Fee"
      subtitle2="Distributed to"
      :grow-column2="true"
      :title3="formatPeriod(fund?.performancePeriod)"
      subtitle3="Fee Period (Days)"
      class="main_grid__item"
    >
      <template #title2>
        <AddressLink
          v-if="fund?.performanceFeeAddress && !isZeroAddress(fund.performanceFeeAddress)"
          :address="fund.performanceFeeAddress"
          :chain-id="fund.chainId"
        />
        <span v-else>N/A</span>
      </template>
    </UiDataRowCard>
    <UiDataRowCard
      :title="formatFee(fund?.depositFee)"
      subtitle="Deposit Fee"
      subtitle2="Distributed to"
      class="main_grid__item"
    >
      <template #title2>
        <AddressLink
          v-if="fund?.depositFeeAddress && !isZeroAddress(fund.depositFeeAddress)"
          :address="fund.depositFeeAddress"
          :chain-id="fund.chainId"
        />
        <span v-else>N/A</span>
      </template>
    </UiDataRowCard>
    <UiDataRowCard
      :title="formatFee(fund?.withdrawFee)"
      subtitle="Exit Fee"
      subtitle2="Distributed to"
      class="main_grid__item"
    >
      <template #title2>
        <AddressLink
          v-if="fund?.withdrawFeeAddress && !isZeroAddress(fund.withdrawFeeAddress)"
          :address="fund.withdrawFeeAddress"
          :chain-id="fund.chainId"
        />
        <span v-else>N/A</span>
      </template>
    </UiDataRowCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type IFund from "~/types/fund";
import AddressLink from "~/components/common/AddressLink.vue";
import { isZeroAddress } from "~/composables/addressUtils";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => ({}),
  },
});

const formatPeriod = (period?: any) => {
  if (period === 0) return "365";
  return JSON.stringify(period);
};

const formatFee = (feeBps?: any) => {
  if (feeBps === undefined || feeBps === null) return "N/A";
  const feePercent = (Number(feeBps) / 100).toString();
  return `${feePercent}%`;
};
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
