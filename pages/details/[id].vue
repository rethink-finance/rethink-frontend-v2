<template>
  <div v-if="loading" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address" class="w-100">
    <!-- TODO this is where the fund header comes -->
    <div>
      <NuxtLink :to="`/details/${$route.params.id}`">
        Fund Details
      </NuxtLink>
      <NuxtLink :to="`/details/${$route.params.id}/governance`">
        Governance
      </NuxtLink>
      <NuxtLink :to="`/details/${$route.params.id}/nav`">
        NAV
      </NuxtLink>
    </div>
    <NuxtPage :fund="fund" />
  </div>
  <div v-else class="d-flex flex-column h-100 align-center">
    <h2 class="mb-2">
      Fund not found
    </h2>
    <p class="text-center">
      Are you sure you are on the right network? <br>
      Try switching to a different network.
    </p>
  </div>

</template>

<script lang="ts" setup>
import { useFundStore } from "~/store/fund.store";
import { useWeb3Store } from "~/store/web3.store";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const route = useRoute();
const loading = ref(true);
const fundAddress = (route.params.id as string).split("-")[1];

onUnmounted(  () => {
  fundStore.fund = { } as IFund;
  fundStore.selectedFundAddress = "";
})

const fetchFund = async () => {
  if (!fundAddress) {
    console.error("No fund address provided in the route.");
    return;
  }
  loading.value = true;

  try {
    await fundStore.getFund(fundAddress);
  } catch (e) {
    console.error("Failed fetching fund -> ", e)
  }

  loading.value = false;
}

watch(() => web3Store.chainId, () => {
  fetchFund();
});

onMounted(  () => {
  fetchFund();
});
const fund = computed(() => fundStore.fund);
</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
</style>
