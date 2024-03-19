<template>
  <div v-if="loading">
    Loading...
  </div>
  <div v-else>
    <div class="fund_details">
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
    </div></div>

</template>

<script lang="ts" setup>
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useFundStore } from "~/store/fund.store";

const route = useRoute();
const fundStore = useFundStore();
const loading = ref(true);
const fundAddress = (route.params.id as string).split("-")[1];

onMounted(async () => {
  loading.value = true;
  if (fundAddress) {
    await fundStore.fetchFunds();
    console.log("Fetching fund: " + fundAddress);
    await fundStore.fetchFund(fundAddress);
    loading.value = false;
  } else {
    console.error("No fund address provided in the route.");
  }
});
const fund = computed(() => fundStore.fund);
// const fund = computed(() => fundStore.fund);
// console.log("Fetch fund: " + route.params.id);
// fundStore.fetchFund(route.params.id as string);

</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
</style>
