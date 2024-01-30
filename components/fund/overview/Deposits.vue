<template>
  <div class="basics_grid">
    <UiDataRowCard :title="fund.fund_token.name" subtitle="Token Symbol" body="test" />
    <UiDataRowCard :title="fund.denomination_token.name" subtitle="Denomination Asset" />
    <UiDataRowCard :title="fund.governor_address" subtitle="Custody Contract" />
    <UiDataRowCard :title="fund.fund_token.address" subtitle="Token Contract" />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue"
import type IFund from "~/types/fund";

export default defineComponent({
  name: "Deposits",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
})
</script>

<style lang="scss" scoped>
.basics_grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem; // Grid column gap
  align-items: start;
}
</style>
