<template>
  <div class="main_grid">
    <UiDataRowCard
      :title="depositsTitle"
      :body="depositsBody"
    />
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default defineComponent({
  name: "Deposits",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  computed: {
    depositsTitle() {
      const addressCount = this.fund?.allowedDepositAddresses?.length ?? 0;
      if (addressCount === 1) {
        return `${addressCount} Address`
      }
      return `${addressCount} Addresses`
    },
    depositsBody() {
      if (this.fund?.allowedDepositAddresses?.length) {
        return this.fund.allowedDepositAddresses.join("\n");
      }
      return "There are currently no whitelisted deposit addresses."
    },
  },
})
</script>

<style lang="scss" scoped>

</style>
