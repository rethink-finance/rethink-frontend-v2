<template>
  <div class="main_grid">
    <UiDataRowCard
      :title="fund.plannedSettlementPeriod || 'N/A'"
      subtitle="Planned Settlement Cycle"
    />
    <UiDataRowCard
      :title="fund.minLiquidAssetShare || 'N/A'"
      subtitle="Min. Liquid Asset Share "
    />
    <!-- We don’t have to show Address, just Planned Settlement Cycle and Planned Liq. Asset Share -->
    <!-- <UiDataRowCard
      :title="managementTitle"
      :body="managementBody"
      subtitle="Management"
    /> -->
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type IFund from "~/types/fund";

export default defineComponent({
  name: "Management",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  computed: {
    managementTitle() {
      const addressCount = this.fund?.managementAddresses?.length ?? 0;
      if (addressCount === 1) {
        return `${addressCount} Address`
      }
      return `${addressCount} Addresses`
    },
    managementBody() {
      if (this.fund?.managementAddresses?.length) {
        return this.fund.managementAddresses.join("\n");
      }
      return "There are currently no addresses."
    },
  },
})
</script>

<style lang="scss" scoped>

</style>
