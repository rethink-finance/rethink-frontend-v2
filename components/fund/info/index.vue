<template>
  <div class="fund_info">
    <FundInfoDescription :fund="fund" />

    <FundInfoInsights :fund="fund" />

    <div v-if="isConnected" class="fund_info__user_data main_grid">
      <FundInfoMyPositions :fund="fund" />
      <FundInfoGovernance :fund="fund" />
    </div>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { useAccountsStore } from "~/store/accounts.store";

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
.fund_info {
  gap: 4.5rem;
  display: flex;
  flex-direction: column;

  @include sm {
    gap: 3rem;
  }
}
</style>
