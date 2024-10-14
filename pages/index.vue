<template>
  <div class="discover">
    <h3 class="main_title">
      Rethink Finance | Run Funds On-Chain
    </h3>
    <div v-if="fetchFundsError" class="w-100 d-flex justify-center flex-column">
      <h3>Oops, something went wrong while getting funds data</h3>
      <span>
        Maybe the current RPC (<a :href="web3Store.currentRPC">{{ web3Store.currentRPC }}</a>) is down?
      </span>
    </div>
    <TableAllFunds v-else :loading="loadingFunds" :items="funds"  />
  </div>
</template>

<script setup lang="jsx">
import { useFundsStore } from "~/store/funds.store";
import { useWeb3Store } from "~/store/web3.store";

const loadingFunds = ref(true);
const funds = computed(() => fundsStore.funds);
const fundsStore = useFundsStore();
const web3Store = useWeb3Store();


const fetchFundsError = ref(false);

const fetchFunds = async () => {
  loadingFunds.value = true;
  fetchFundsError.value = false;

  try {
    await fundsStore.fetchFunds();
  } catch (e) {
    console.error("fetchFunds -> ", e);
    fetchFundsError.value = true;
  }
  loadingFunds.value = false;
}
onMounted(() => fetchFunds());


watch(() => web3Store.chainId, () => {
  fetchFunds();
});
</script>

<style lang="scss">
.discover {
  width: 100%;
}
</style>
