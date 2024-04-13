<template>
  <div v-if="loading" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
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
          <FundChart />
        </div>
      </div>

      <FundOverview :fund="fund" />
    </div>
  </div>

</template>

<script lang="ts" setup>
import { useFundStore } from "~/store/fund.store";
import type IFund from "~/types/fund";

const route = useRoute();
const fundStore = useFundStore();
const loading = ref(true);
const fundAddress = (route.params.id as string).split("-")[1];

onUnmounted(  () => {
  fundStore.fund = { } as IFund;
  fundStore.selectedFundAddress = "";
})

onMounted(  async () => {

  if (fundAddress) {
    loading.value = true;

    // This means that a lot of its data was already fetched.
    try {
      await fundStore.getFund(fundAddress);
    } catch (e) {
      console.error("Failed fetching fund -> ", e)
    }

    loading.value = false;
  } else {
    console.error("No fund address provided in the route.");
  }
});
const fund = computed(() => fundStore.fund);
</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
</style>
