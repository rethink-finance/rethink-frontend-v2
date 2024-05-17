<template>
  <div>
    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        Governance Settings
      </div>
      <div>
        <FundOverviewGovernance :fund="fund" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss">

</style>
