<template>
  <div class="main_grid main_grid--full-width">
    <UiDataRowCard
      title="2%"
      subtitle="Management Fee"
      title2="0xbbcc3c4d5e6f7g8h9i0j1k2l3m4n5o67q8r9s0t"
      subtitle2="Distributed to"
      :grow-column2="true"
      title3="5%"
      subtitle3="Hurdle Rate"
    />
    <UiDataRowCard :title="fund.governorToken?.address" subtitle="Governance Token" />
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
})
</script>

<style lang="scss" scoped>
</style>
