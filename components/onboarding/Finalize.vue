<template>
  <div class="onboarding_finalize">
    <template v-if="isFundCreateFinalized">
      <span class="onboarding_finalize__badge">Created</span>
      <p class="onboarding_finalize__lead">
        <span class="onboarding_finalize__name">{{ fundSettings?.fundName }}</span>
        was created successfully.
      </p>
      <p class="onboarding_finalize__body">
        You will be redirected to the vault details page after the node gets
        synced.
      </p>
      <v-progress-circular
        class="onboarding_finalize__spinner"
        size="30"
        width="3"
        indeterminate
      />
      <nuxt-link class="onboarding_finalize__link" to="/">
        Go to discover
      </nuxt-link>
    </template>

    <template v-else-if="isFinalizingFundCreation">
      <p class="onboarding_finalize__body">
        Finalizing vault creation.
      </p>
      <v-progress-circular
        class="onboarding_finalize__spinner"
        size="30"
        width="3"
        indeterminate
      />
    </template>

    <template v-else>
      <h2 class="onboarding_finalize__title">
        Finalize vault creation
      </h2>
      <p class="onboarding_finalize__body">
        Finalising opens the vault for deposits and locks the setup. Changing
        permissions and NAV methods will require a governance vote.
      </p>
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

const { fundChainId, fundSettings, fundFactoryContract } =
  storeToRefs(createFundStore);
const { navigateToFundDetails } = usePageNavigation();

const isFetchingNewlyCreatedFundSettings = ref(false);
const isFinalizingFundCreation = ref(false);
const isFundCreateFinalized = ref(false);

const finalizeCreateFund = async () => {
  console.warn("finalizeCreateFund");
  if (!fundChainId.value) {
    return toastStore.errorToast("Fund chain ID not set.");
  }

  if (!fundFactoryContract.value) {
    console.error("No fund factory contract value");
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
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Fund was created successfully.");
          isFundCreateFinalized.value = true;

          // Clear local storage for this chain.
          createFundStore.clearFundLocalStorage();
        } else {
          toastStore.errorToast(
            "The Create Fund tx has failed. Please contact the Rethink Finance community for support.",
          );
        }
      })
      .on("error", (error: any) => {
        console.error("error when initializing", error);
        isFinalizingFundCreation.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the vault");
  } finally {
    isFinalizingFundCreation.value = false;
  }
};

// TODO to be safe we could already start doing this check after: isFinalizingFundCreation
watch(
  () => isFundCreateFinalized.value,
  (isFinalized: boolean) => {
    if (!isFinalized) return;
    // If fund was finalized, we can try fetching fund settings and if the node
    // is synced already we can redirect the user to the fund details page.
    navigateToFundDetailsAfterFinalizedSuccessfully();
  },
);

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

    // Redirect to fund details page.
    navigateToFundDetails(
      fundChainId.value,
      fundSettings?.value?.fundSymbol || "",
      fundSettings?.value?.fundAddress || "",
    );
  }
};

// The button lives in the page's sticky footer with every other step's primary.
defineExpose({
  finalize: finalizeCreateFund,
  isFinalizing: isFinalizingFundCreation,
  isDone: isFundCreateFinalized,
});
</script>

<style scoped lang="scss">
.onboarding_finalize {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
  text-align: center;

  &__title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__badge {
    padding: 0.25rem 0.5rem;
    border: 1px solid $color-yield-line;
    border-radius: $default-border-radius;
    background: $color-yield-soft;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-yield;
  }

  &__lead {
    margin-top: 1rem;
    font-size: 15px;
    line-height: 1.5;
    color: $color-white;
  }

  &__name {
    color: $color-cyan;
  }

  &__body {
    max-width: 56ch;
    margin-top: 0.625rem;
    font-size: 13.5px;
    line-height: 1.6;
    color: $color-steel-blue;
  }

  &__spinner {
    margin-top: 1.25rem;
    color: $color-cyan;
  }

  &__link {
    margin-top: 1.25rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;

    &:visited,
    &:hover,
    &:active {
      color: $color-cyan;
    }
  }
}
</style>
