<template>
  <div class="methods main_grid main_grid--full-width main_grid--no-gap">
    <FundNavMethodsTable :methods="fund.navMethods" />
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default defineComponent({
  name: "NAVUpdates",
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
