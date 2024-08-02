<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div>
        <div class="section_title">
          Current Cycle
        </div>
      </div>
      <div v-if="userDepositRequestExists || userRedemptionRequestExists" class="fund_settlement__buttons">
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
          <template v-if="userRedemptionRequestExists">
            {{ redemptionDisabledTooltipText }}
          </template>
        </v-tooltip>
      </div>
    </div>
    <div v-if="userDepositRequestExists || userRedemptionRequestExists" class="fund_settlement__pending_requests">
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
    <div v-else-if="!accountStore.isConnected" class="fund_settlement__no_pending_requests">
      Connect your wallet to view deposit or redemption requests.
    </div>
    <div v-else class="fund_settlement__no_pending_requests">
      Currently there are no deposit or redemption requests.
    </div>
    <div class="card_box card_box--no-padding mt-8">
      <FundSettlementNotification />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { computed, ref } from "vue";
import type IFund from "~/types/fund";
import { useToastStore } from "~/store/toast.store";
import { useFundStore } from "~/store/fund.store";

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
  userDepositRequestExists,
  userRedemptionRequestExists,
} = toRefs(fundStore);

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
})
const isProcessRequestDisabled = computed(() => {
  if (isAnythingLoading.value) return true;

  // Do not disable process request button if the user can do deposit or withdrawal.
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
    withdraw();
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
  console.log("allwoance", userFundAllowance.value)
  console.log("userDepositRequest", userDepositRequest?.value?.amount || 0n)
  if (userFundAllowance.value < (userDepositRequest?.value?.amount || 0n)) {
    return "Not enough allowance to process the deposit request."
  }
  return ""
});
const redemptionDisabledTooltipText = computed(() => {
  if (!userRedemptionRequestExists.value) {
    return "There is no withdrawal request."
  }
  if (userFundTokenBalance.value < (userRedemptionRequest?.value?.amount || 0n)) {
    return "Not enough fund tokens to process the withdrawals request."
  }
  return ""
});

const deposit = async () => {
  if (!accountStore.activeAccount?.address) {
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
  console.log("Deposit tokensWei: ", userDepositRequest?.value?.amount, "from : ", accountStore.activeAccount.address);

  const ABI = [ "function deposit()" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("deposit");
  const [gasPrice, gasEstimate] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
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


const withdraw = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the fund.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  if (!userRedemptionRequest?.value?.amount) {
    toastStore.errorToast("Deposit request data is missing.")
    return;
  }
  console.log("[REDEEM]");
  loadingRedemption.value = true;
  console.log("[REDEEM] tokensWei: ", userRedemptionRequest?.value?.amount, "from : ", accountStore.activeAccount.address);

  const ABI = [ "function withdraw()" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("withdraw");
  const [gasPrice, gasEstimate] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
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
          "Your withdrawal was successful. It may take 10 seconds or more for values to update.",
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
</style>
