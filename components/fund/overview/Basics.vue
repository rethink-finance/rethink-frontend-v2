<template>
  <div class="basics_grid">
    <UiDataRowCard title="1FND" subtitle="Token Symbol" />
    <UiDataRowCard title="USDC" subtitle="Denomination Asset" />
    <UiDataRowCard title="USDC" subtitle="Denomination Asset" />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue"
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
.basics_grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem; // Grid column gap
}
</style>
