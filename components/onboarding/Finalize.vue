<template>
  <div class="onboarding_finalize">
    <template v-if="isFundCreateFinalized">
      <div>
        <strong>{{ fundSettings?.fundName }}</strong>
        was created successfully.
      </div>
      <Icon
        icon="noto:party-popper"
        width="60"
        height="60"
        class="my-2"
      />

      You will be redirected to the vault details page after the node gets synced.
      <div class="d-flex align-items-center align-center flex-column">
        <v-progress-circular
          class="mt-2"
          size="30"
          width="3"
          indeterminate
        />
      </div>
    </template>
    <div
      v-else-if="isFinalizingFundCreation"
      class="d-flex align-items-center align-center flex-column"
    >
      <div class="pb-4">
        Finalizing fund creation.
      </div>
      <v-progress-circular
        class="mt-2"
        size="30"
        width="3"
        indeterminate
      />
    </div>
    <template v-else>
      <p>
        After finalizing the setup users will be able to deposit into your vault.
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useFundStore } from "~/store/fund/fund.store";
import { usePageNavigation } from "~/composables/routing/usePageNavigation";

const fundStore = useFundStore();
const toastStore = useToastStore();
const createFundStore = useCreateFundStore();

const {
  fundChainId,
  fundSettings,
  askToSaveDraftBeforeRouteLeave,
  fundFactoryContract,
} = storeToRefs(createFundStore);
const { navigateToFundDetails } = usePageNavigation();

const isFetchingNewlyCreatedFundSettings = ref(false);
const isFinalizingFundCreation = ref(false);
const isFundCreateFinalized = ref(false);

const finalizeCreateFund = async () => {
  console.warn("finalizeCreateFund");
  if (!fundChainId.value) {
    return toastStore.errorToast("Fund chain ID not set.")
  }

  if (!fundFactoryContract.value) {
    return toastStore.errorToast(
      `Cannot create fund on chain ${fundChainId.value}.`,
    );
  }
  isFinalizingFundCreation.value = true;

  try {
    await fundFactoryContract.value
      .send("finalizeCreateFund", {}, [])
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      }).on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Fund was created successfully.");
          isFundCreateFinalized.value = true;

          // Clear local storage for this chain.
          createFundStore.clearFundLocalStorage();
        } else {
          toastStore.errorToast("The Create Fund tx has failed. Please contact the Rethink Finance community for support.");
        }
      }).on("error", (error: any) => {
        console.error("error when initializing", error);
        isFinalizingFundCreation.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error:any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the vault");
  } finally {
    isFinalizingFundCreation.value = false;
  }
};

// TODO to be safe we could already start doing this check after: isFinalizingFundCreation
watch(() => isFundCreateFinalized.value, (isFinalized: boolean) => {
  if (!isFinalized) return;
  // If fund was finalized, we can try fetching fund settings and if the node
  // is synced already we can redirect the user to the fund details page.
  navigateToFundDetailsAfterFinalizedSuccessfully()
})

const navigateToFundDetailsAfterFinalizedSuccessfully = async () => {
  if (!isFundCreateFinalized.value) return;
  // If fund was finalized, we can try fetching fund settings and if the node
  // is synced already we can redirect the user to the fund details page.
  isFetchingNewlyCreatedFundSettings.value = true;
  const fundSettingsData = await fundStore.fetchFundSettings(
    fundChainId.value,
    fundSettings?.value?.fundAddress || "",
  );
  console.log("fundSettingsData", fundSettingsData);

  // If fund address is set already in the fund settings, it means that
  // node has data already, and we can redirect to fund details.
  if (isZeroAddress(fundSettingsData?.fundAddress)) {
    // Sleep for 1 second before continuing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await navigateToFundDetailsAfterFinalizedSuccessfully();
  } else {
    isFetchingNewlyCreatedFundSettings.value = false;

    // Disable guard when leaving fund create to not ask for saving draft.
    askToSaveDraftBeforeRouteLeave.value = false;

    // Redirect to fund details page.
    navigateToFundDetails(
      fundChainId.value,
      fundSettings?.value?.fundSymbol || "",
      fundSettings?.value?.fundAddress || "",
    )
  }
}
</script>

<style scoped lang="scss">
.onboarding_finalize {
  padding-block: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
</style>
