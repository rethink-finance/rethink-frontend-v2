<template>
  <div class="main_grid">
    <UiDataRowCard :title="fund.fundToken?.name" subtitle="Token Symbol" />
    <UiDataRowCard :title="fund.denominationToken?.name" subtitle="Denomination Asset" />
    <UiDataRowCard :title="fund.governorAddress" subtitle="Custody Contract" />
    <UiDataRowCard :title="fund.fundToken?.address" subtitle="Token Contract" />
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default defineComponent({
  name: "Basics",
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
