<template>
  <div class="transfer">
    <div class="transfer__content">
      <div class="transfer__header">
        <div class="transfer__title">
          Transfer Base Asset to the Safe Contract
        </div>
        <div class="transfer__subtitle">
          Transfer any excess base asset amount from the admin contract back to the custody contract.
        </div>
      </div>

      <FundSettlementAlert v-if="!isConnected">
        Connect your wallet to sweep the admin contract.
      </FundSettlementAlert>
      <div class="buttons_container">
        <div>
          <v-tooltip
            activator="parent"
            location="bottom"
            :disabled="!isConnected"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                class="bg-primary text-secondary"
                :disabled="isSweepContractDisabled"
                @click="sweepFundContract()"
              >
                <template #prepend>
                  <v-progress-circular
                    v-if="isSweepLoading"
                    class="d-flex"
                    size="20"
                    width="3"
                    indeterminate
                  />
                </template>
                Sweep Admin Contract
              </v-btn>
            </template>
            <template #default>
              {{ sweepContractTooltipText }}
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { eth } from "web3";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";

const accountStore = useAccountStore();
const toastStore = useToastStore();
const fundStore = useFundStore();

const { isConnected } = storeToRefs(accountStore);
const isSweepLoading = ref(false);

const isSweepContractDisabled = computed(() => {
  return (
    !!sweepContractTooltipText.value ||
    isSweepLoading.value ||
    !isConnected.value
  );
});
const sweepContractTooltipText = computed(() => {
  if (!isConnected.value) {
    return "Connect your wallet to sweep the admin contract.";
  } else if (!fundContractBaseTokenBalance.value) {
    // TODO actually we need to check if there are excess OIVs to sweep.
    return "Currently there are no base assets in the admin contract to sweep.";
  }
  return "";
});

const fundContractBaseTokenBalance = computed(() => {
  return fundStore.fund?.fundContractBaseTokenBalance || 0n;
});

const sweepFundContract = async () => {
  isSweepLoading.value = true;

  try {
    const functionSignatureHash =
      eth.abi.encodeFunctionSignature("sweepTokens()");

    await fundStore.fundContract
      .send("fundFlowsCall", {}, functionSignatureHash)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: ", hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);
        if (receipt.status) {
          toastStore.successToast("Fund contract sweep was successful.");
          // Refresh balances
          // TODO repeat every 1 second, 15x until the value changes, as node sync takes some time.
          fundStore.fetchFundContractBaseTokenBalance();
        } else {
          toastStore.errorToast(
            "Your deposit request has failed. Please contact the Rethink Finance support.",
          );
          fundStore.fetchUserFundData(
            fundStore.selectedFundChain,
            fundStore.selectedFundAddress,
          );
        }
        isSweepLoading.value = false;
      })
      .on("error", (error: any) => {
        handleError(error);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.");
  } else {
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
    console.error(error);
  }
  isSweepLoading.value = false;
};
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
.transfer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-size: $text-sm;
  line-height: 1;
  height: 100%;
  justify-content: space-between;

  &__content {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-grow: 1;
    justify-content: space-between;
  }
  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__title {
    font-size: $text-md;
    font-weight: 500;
    color: $color-title;
    margin-bottom: 0.5rem;
  }
  &__subtitle {
    font-size: $text-md;
    color: $color-light-subtitle;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle;
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.15rem;
  }
}

.set_token_value_button {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
</style>
