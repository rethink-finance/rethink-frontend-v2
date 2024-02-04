<template>
  <div class="fund_details mt-8">
    <div class="main_card">
      <FundInfo :fund="fund" />
    </div>

    <div class="d-flex flex-column">
      <div class="main_card main_grid order-1 order-sm-0">
        <FundSettlement :fund="fund" />
        <FundCurrentCycle :fund="fund" />
      </div>

      <div class="main_card">
        <FundChart :fund-id="fund.id" />
      </div>
    </div>

    <FundOverview :fund="fund" />
  </div>
</template>

<script lang="ts" setup>
import { useFundStore } from "~/store/modules/fund.store";

const route = useRoute();
const fundStore = useFundStore();

const fund = computed(() => fundStore.fund);
console.log("Fetch fund: " + route.params.id);
fundStore.fetchFund(route.params.id as string);
</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
  padding: 0 1rem;

  @include sm {
    width: 70%;
    padding: 0;
  }
}

.fund_settlement_cycle_chart_wrapper {
  display: flex;
  flex-direction: column;
}

</style>
