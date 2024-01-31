<template>
  <div class="main_card__grid">
    <UiDataRowCard
      :title="fund.planned_settlement_cycle"
      subtitle="Planned Settlement Cycle"
    />
    <UiDataRowCard
      :title="fund.min_liquid_asset_share"
      subtitle="Min. Liquid Asset Share "
    />
    <UiDataRowCard
      :title="managementTitle"
      :body="managementBody"
      subtitle="Management"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue"
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
      const addressCount = this.fund?.management_addresses?.length ?? 0;
      if (addressCount === 1) {
        return `${addressCount} Address`
      }
      return `${addressCount} Addresses`
    },
    managementBody() {
      if (this.fund?.management_addresses?.length) {
        return this.fund.management_addresses.join("\n");
      }
      return "There are currently no addresses."
    },
  },
})
</script>

<style lang="scss" scoped>

</style>
