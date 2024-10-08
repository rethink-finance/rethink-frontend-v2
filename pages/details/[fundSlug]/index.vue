<template>
  <div class="fund_details">
    <FundOverview :fund="fund" />

    <div class="main_card">
      <FundInfo :fund="fund" />
    </div>

    <div class="d-flex flex-column">
      <div class="main_card main_grid order-1 order-sm-0">
        <FundSettlement :fund="fund" :shouldUserDelegate="shouldUserDelegate" />
        <FundCurrentCycle :fund="fund" />
      </div>

      <div class="main_card">
        <FundChart :fund="fund" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund.store";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const { shouldUserDelegate } = toRefs(fundStore);

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss"></style>
