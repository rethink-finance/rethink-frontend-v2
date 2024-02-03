<template>
  <div class="fund_info">
    <FundInfoDescription :fund="fund" />

    <FundInfoInsights :fund="fund" />
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default {
  name: "Info",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
};
</script>

<style lang="scss" scoped>
</style>
