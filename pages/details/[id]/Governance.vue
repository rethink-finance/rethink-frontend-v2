<template>
  <div>
    Fund Governance page is coming soon for <strong>{{ fund.title }}</strong>.
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss">

</style>
