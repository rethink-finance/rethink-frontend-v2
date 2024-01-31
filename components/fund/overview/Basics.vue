<template>
  <div class="main_card__grid">
    <UiDataRowCard :title="fund.fund_token.name" subtitle="Token Symbol" />
    <UiDataRowCard :title="fund.denomination_token.name" subtitle="Denomination Asset" />
    <UiDataRowCard :title="fund.governor_address" subtitle="Custody Contract" />
    <UiDataRowCard :title="fund.fund_token.address" subtitle="Token Contract" />
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
