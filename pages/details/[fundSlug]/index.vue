<template>
  <div class="fund_details">
    <div class="main_card">
      <FundInfo :fund="fund" />
    </div>

    <div class="d-flex flex-column">
      <div class="main_card main_grid order-1 order-sm-0">
        <FundSettlement :fund="fund" />
        <!-- TODO current cycle is work in progress -->
        <!--          <FundCurrentCycle :fund="fund" />-->
      </div>

      <div class="main_card">
        <FundChart :fund="fund" />
      </div>
    </div>

    <FundOverview :fund="fund" />
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss">

</style>
