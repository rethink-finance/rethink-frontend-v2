<template>
  <div>
    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        NAV Methods
      </div>
      <div>
        <FundNavMethods :fund="fund" />
      </div>
    </div>
    <div class="main_card">
      <div class="main_expansion_panel__subtitle">
        NAV Updates
      </div>
      <div>
        <FundNavUpdates :fund="fund" />
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
