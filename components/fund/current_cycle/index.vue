<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div class="card_header__title">
        Pending Requests
      </div>
      <div
        v-if="userDepositRequestExists || userRedemptionRequestExists"
        class="fund_settlement__buttons"
      >
        <v-tooltip
          :disabled="!(depositDisabledTooltipText || redemptionDisabledTooltipText)"
          activator="parent"
          location="bottom"
        >
          <template #activator="props">
            <v-btn
              v-bind="props"
              :disabled="isProcessRequestDisabled"
              @click="processRequest"
            >
              <template #prepend>
                <v-progress-circular
                  v-if="isAnythingLoading"
                  class="d-flex"
                  size="20"
                  width="3"
                  indeterminate
                />
              </template>
              Process Request
            </v-btn>
          </template>
          <template v-if="userDepositRequestExists">
            {{ depositDisabledTooltipText }}
          </template>
          <br v-if="userDepositRequestExists && userRedemptionRequestExists">
          <template v-if="userRedemptionRequestExists">
            {{ redemptionDisabledTooltipText }}
          </template>
        </v-tooltip>
      </div>
    </div>
    <div v-if="!accountStore.isConnected" class="fund_settlement__no_pending_requests">
      Connect your wallet to view deposit or redemption requests.
    </div>
    <div v-else-if="loadingUserFundDepositRedemptionRequests">
      <v-skeleton-loader type="list-item-two-line" />
      <v-skeleton-loader type="list-item-two-line" />
    </div>
    <div
      v-else-if="userDepositRequestExists || userRedemptionRequestExists"
      class="fund_settlement__pending_requests"
    >
      <FundCurrentCyclePendingRequest
        v-if="userDepositRequestExists"
        :fund-transaction-request="userDepositRequest"
        :exchange-rate="baseToFundTokenExchangeRate"
        :token0="fund.baseToken"
        :token1="fund.fundToken"
      />
      <FundCurrentCyclePendingRequest
        v-if="userRedemptionRequestExists"
        :fund-transaction-request="userRedemptionRequest"
        :exchange-rate="fundToBaseTokenExchangeRate"
        :token1="fund.baseToken"
        :token0="fund.fundToken"
      />
    </div>
    <div v-else class="fund_settlement__no_pending_requests">
      Currently there are no deposit or redemption requests.
    </div>
    <div class="card_box card_box--no-padding mt-8">
      <UiNotification>
        The deposit and redeem requests are settled within the planned Settlement Cycle
        of <span class="text-primary">{{ fund?.plannedSettlementPeriod || "N/A" }}</span>.
        You can learn more about how settlements work
        <a href="https://docs.rethink.finance/rethink.finance" target="_blank">here</a>.
      </UiNotification>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { computed, ref } from "vue";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import type IFund from "~/types/fund";

import { useAccountStore } from "~/store/account.store";
const emit = defineEmits(["deposit-success"]);

const toastStore = useToastStore()
const fundStore = useFundStore()
const accountStore = useAccountStore();
const {
  userFundAllowance,
  userFundTokenBalance,
  userDepositRequest,
  userRedemptionRequest,
  baseToFundTokenExchangeRate,
  fundToBaseTokenExchangeRate,
  shouldUserWaitSettlementOrCancelDeposit,
  shouldUserWaitSettlementOrCancelRedemption,
  userDepositRequestExists,
  userRedemptionRequestExists,
  loadingUserFundDepositRedemptionRequests,
} = toRefs(fundStore);

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
})
const isProcessRequestDisabled = computed(() => {
  if (isAnythingLoading.value) return true;

  // Do not disable process request button if the user can do either deposit or redemption.
  if (!depositDisabledTooltipText.value || !redemptionDisabledTooltipText.value) {
    return false;
  }
  return true
});

const processRequest = () => {
  if (userDepositRequestExists.value) {
    deposit();
  }
  if (userRedemptionRequestExists.value) {
    redeem();
  }
}

const loadingDeposit = ref(false);
const loadingRedemption = ref(false);

const isAnythingLoading = computed(() => {
  return loadingDeposit.value || loadingRedemption.value;
});
const depositDisabledTooltipText = computed(() => {
  if (!userDepositRequestExists.value) {
    return "There is no deposit request."
  }
  if (userFundAllowance.value < (userDepositRequest?.value?.amount || 0n)) {
    return "Not enough allowance to process the deposit request."
  }
  if (shouldUserWaitSettlementOrCancelDeposit.value) {
    return "Wait for settlement or cancel the deposit request."
  }
  if (!fundStore.isUserWalletWhitelisted) {
    return "Your wallet address is not whitelisted to allow deposits into this fund."
  }
  return ""
});
const redemptionDisabledTooltipText = computed(() => {
  if (!userRedemptionRequestExists.value) {
    return "There is no redemption request."
  }
  const redemptionRequestAmount = userRedemptionRequest?.value?.amount || 0n;
  if (userFundTokenBalance.value < redemptionRequestAmount) {
    return "Not enough fund tokens to process the redemptions request."
  }
  if (shouldUserWaitSettlementOrCancelRedemption.value) {
    return "Wait for settlement or cancel the redemption request."
  }
  // Check if there is even enough liquidity in the fund contract to redeem the requested amount.
  const fundContractBaseTokenBalance = fundStore.fund?.fundContractBaseTokenBalance || 0n;
  if (fundContractBaseTokenBalance > redemptionRequestAmount) {
    return "Not enough liquidity in the fund contract."
  }
  if (!fundStore.isUserWalletWhitelisted) {
    return "Your wallet address is not whitelisted to allow deposits into this fund."
  }
  return ""
});

const deposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the fund.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  if (!userDepositRequest?.value?.amount) {
    toastStore.errorToast("Deposit request data is missing.")
    return;
  }
  console.log("DEPOSIT");
  loadingDeposit.value = true;
  console.log("Deposit tokensWei: ", userDepositRequest?.value?.amount, "from : ", fundStore.activeAccountAddress);

  const ABI = [ "function deposit()" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("deposit");
  const [gasPrice, gasEstimate] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: fundStore.activeAccountAddress,
      gas: gasEstimate,
      gasPrice,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      // Refresh user balances & allowance & refresh pending requests.
      fundStore.fetchUserBalances();

      if (receipt.status) {
        toastStore.successToast("Your deposit was successful.");

        // emit event to open the delegate votes modal
        emit("deposit-success");
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingDeposit.value = false;
    }).on("error", (error: any) => {
      loadingDeposit.value = false;
      handleError(error);
    });
  } catch (error: any) {
    loadingDeposit.value = false;
    handleError(error);
  }
}


const redeem = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the fund.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  if (!userRedemptionRequest?.value?.amount) {
    toastStore.errorToast("Redemption request data is missing.")
    return;
  }
  console.log("[REDEEM]");
  loadingRedemption.value = true;
  console.log("[REDEEM] tokensWei: ", userRedemptionRequest?.value?.amount, "from : ", fundStore.activeAccountAddress);

  const ABI = [ "function withdraw()" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("withdraw");
  const [gasPrice, gasEstimate] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: fundStore.activeAccountAddress,
      gas: gasEstimate,
      gasPrice,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      // Refresh user balances & allowance.
      fundStore.fetchUserBalances();

      if (receipt.status) {
        toastStore.successToast(
          "Your redemption was successful. It may take 10 seconds or more for values to update.",
        );
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingRedemption.value = false;
    }).on("error", (error: any) => {
      loadingRedemption.value = false;
      handleError(error);
    });
  } catch (error: any) {
    loadingRedemption.value = false;
    handleError(error);
  }
}

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if (error?.code === 4001) {
    toastStore.addToast("Transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
  }
}
</script>

<style lang="scss" scoped>
.fund_settlement {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;

  &__buttons {
    display: flex;
    gap: 1rem;
  }
  &__pending_requests {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  &__no_pending_requests {
    display: flex;
    flex-grow: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
}

.card_header{
  &__title{
    font-size: 1rem;
    font-weight: bold;
    color: $color-subtitle;
    line-height: 1;
    margin-bottom: 0.75rem;

    @include sm{
      margin-bottom: 0
    }
  }
}
</style>
