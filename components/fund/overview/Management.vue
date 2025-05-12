<template>
  <div class="main_grid">
    <UiDataRowCard
      :title="parsedPlannedSettlement"
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
import { parsePlannedSettlement } from "~/composables/fund/parsePlannedSettlement";
import type IFund from "~/types/fund";

export default defineComponent({
  name: "Management",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  data() {
    return {
      parsedPlannedSettlement: "",
    };
  },
  computed: {
    managementTitle() {
      const addressCount = this.fund?.allowedManagerAddresses?.length ?? 0;
      if (addressCount === 1) {
        return `${addressCount} Address`
      }
      return `${addressCount} Addresses`
    },
    managementBody() {
      if (this.fund?.allowedManagerAddresses?.length) {
        return this.fund.allowedManagerAddresses.join("\n");
      }
      return "There are currently no addresses."
    },
  },
  async mounted() {
    await parsePlannedSettlement(this.fund?.chainId, this.fund?.plannedSettlementPeriod)
      .then((result) => {
        this.parsedPlannedSettlement = result;
      })
      .catch((error) => {
        console.error("Error parsing planned settlement", error);
      })
  },
})
</script>

<style lang="scss" scoped>

</style>
