<template>
  <div class="onboarding_finalize">
    <p>
      After finalizing the setup users will be able to deposit into your OIV.
    </p>
    <p>
      Please note that any future change after finalization will go through governance.
    </p>

    <v-btn
      color="primary"
      @click="finalizeCreateFund"
    >
      Finalize
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { useWeb3Store } from "~/store/web3/web3.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();

const { fundChainId } = toRefs(createFundStore);

const isInitializeLoading = ref(false);

const finalizeCreateFund = async () => {
  console.warn("finalizeFundCreation");
  if (!fundChainId.value) {
    return toastStore.errorToast("Fund chain ID not set.")
  }
  const fundFactoryContract = web3Store.chainContracts[fundChainId.value]?.fundFactoryContract;

  if (!fundFactoryContract) {
    return toastStore.errorToast(
      `Cannot create fund on chain ${fundChainId.value}.`,
    );
  }
  isInitializeLoading.value = true;

  try {
    await fundFactoryContract
      .send("createFund", {}, [])
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      }).on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Fund was created successfully.");
        } else {
          toastStore.errorToast("The Create Fund tx has failed. Please contact the Rethink Finance community for support.");
        }
      }).on("error", (error: any) => {
        console.error("error when initializing", error);
        isInitializeLoading.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error:any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the OIV");
  } finally {
    isInitializeLoading.value = false;
  }
};
</script>

<style scoped lang="scss">
.onboarding_finalize {
  padding-block: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
</style>
