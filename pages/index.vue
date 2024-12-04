<template>
  <div class="discover">
    <h3 class="main_title">
      Rethink Finance | Run Funds On-Chain
    </h3>
    <div v-if="isErrorFetchFundsData" class="w-100 d-flex justify-center flex-column">
      <h3>Oops, something went wrong while getting OIVs data</h3>
      <span>
        Maybe the current RPC (<a :href="web3Store.currentRPC">{{ web3Store.currentRPC }}</a>) is down?
      </span>
    </div>
    <TableAllFunds v-else :loading="isLoadingFetchFundsData" :items="funds"  />
  </div>
</template>

<script setup lang="jsx">
import { useActionStateStore } from "~/store/actionState.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ActionState } from "~/types/enums/action_state";

const funds = computed(() => fundsStore.funds);
const fundsStore = useFundsStore();
const actionStateStore = useActionStateStore();
const web3Store = useWeb3Store();

const isLoadingFetchFundsData = computed(() => actionStateStore.isActionState("fetchFundsAction", ActionState.Loading));
const isErrorFetchFundsData = computed(() => actionStateStore.isActionState("fetchFundsAction", ActionState.Error));

onMounted(async () => await fundsStore.fetchFunds());

watch(() => web3Store.chainId, async () => {
  await fundsStore.fetchFunds()
});
</script>

<style lang="scss">
.discover {
  width: 100%;
}
</style>
