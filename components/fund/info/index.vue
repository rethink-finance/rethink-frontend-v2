<template>
  <div class="fund_info">
    <FundInfoDescription :fund="fund" />

    <FundInfoInsights :fund="fund" />

    <div v-if="isConnected">
      <FundInfoMyPositions :fund="fund" />
    </div>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { useAccountsStore } from "~/store/modules/accounts.store";

export default {
  name: "Info",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  setup() {
    const { isConnected } = storeToRefs(useAccountsStore());
    return { isConnected }
  },
};
</script>

<style lang="scss" scoped>
</style>
