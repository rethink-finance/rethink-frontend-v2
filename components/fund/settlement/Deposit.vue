<template>
  <FundSettlementBaseForm
    v-if="fund"
    v-model="tokenValue"
    :token0="fund.baseToken"
    :token1="fund.fundToken"
    :token0-user-balance="fundStore.userBaseTokenBalance"
    :token1-user-balance="fundStore.userFundTokenBalance"
    :exchange-rate="fundStore.baseToFundTokenExchangeRate"
  >
    <template #buttons>
      <div v-if="accountStore.isConnected">
        <div class="deposit_button_group">
          <template v-if="shouldUserWaitSettlementOrCancelDeposit">
            <h3>
              Wait for settlement or cancel the deposit request.
            </h3>
          </template>
          <template v-else-if="canUserProcessDeposit">
            <h3>
              You can now process or cancel the deposit request.
            </h3>
          </template>
          <template v-for="(button) in buttons">
            <v-tooltip
              v-if="button.isVisible"
              :disabled="!button.tooltipText"
              bottom
            >
              <template #default>
                {{ button.tooltipText }}
              </template>
              <template #activator="{ props }">
                <!-- Wrap it in the span to show the tooltip even if the button is disabled. -->
                <span v-bind="props">
                  <v-btn
                    class="bg-primary text-secondary"
                    :disabled="button.disabled"
                    @click="button.onClick"
                  >
                    <template #prepend>
                      <v-progress-circular
                        v-if="button.loading"
                        class="d-flex"
                        size="20"
                        width="3"
                        indeterminate
                      />
                    </template>
                    {{ button.name }}
                  </v-btn>
                </span>
              </template>
            </v-tooltip>
          </template>
          <div v-if="showApproveAllowanceWarning" class="d-flex align-center">
            <Icon
              icon="zondicons:exclamation-outline"
              class="text-warning me-1"
              height="1.2rem"
              width="1.2rem"
            />
            Approve at least
            <strong
              class="set_approve_allowance_button mx-1"
              @click="setTokenValueToDepositRequestAmount"
            >
              {{ depositRequestAmountFormatted }} {{ fundStore?.fund?.baseToken.symbol }}
            </strong>
            to process the deposit request.
          </div>
        </div>
        <div v-if="visibleErrorMessages && tokenValueChanged" class="text-red mt-4 text-center">
          <div v-for="(error, index) in visibleErrorMessages" :key="index">
            {{ error.message }}
          </div>
        </div>
      </div>
      <template v-else>
        <v-btn class="bg-primary text-secondary" @click="accountStore.connectWallet()">
          Connect Wallet
        </v-btn>
      </template>
    </template>
  </FundSettlementBaseForm>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { computed, ref } from "vue";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";


const toastStore = useToastStore();
const accountStore = useAccountStore();
const fundStore = useFundStore();
const tokenValue = ref("0.0");
const tokenValueChanged = ref(false);
const fund = computed(() => fundStore.fund);
const {
  shouldUserRequestDeposit,
  shouldUserApproveAllowance,
  canUserProcessDeposit,
  shouldUserWaitSettlementOrCancelDeposit,
  userDepositRequest,
  userDepositRequestExists,
} = toRefs(fundStore);

const loadingRequestDeposit = ref(false);
const loadingApproveAllowance = ref(false);

watch(() => tokenValue.value, () => {
  tokenValueChanged.value = true;
});

interface IError {
  message: string,
  display: boolean,
}
const rules = [
  (value: string): boolean | IError => {
    if (!fund.value) return { message: "Fund data is missing.", display: true }
    const valueWei = ethers.parseUnits(value, fund.value?.baseToken.decimals);
    if (valueWei <= 0) return { message: "Value must be positive.", display: false }

    console.log("[DEPOSIT] check user base token balance wei: ", valueWei, fundStore.userBaseTokenBalance);
    // This condition is only valid for Request Deposit, we don't check this condition for Approve.
    if (!userDepositRequestExists.value && fundStore.userBaseTokenBalance < valueWei) {
      const userBaseTokenBalanceFormatted = formatTokenValue(fundStore.userBaseTokenBalance, fund.value.baseToken.decimals);
      return {
        message: `Your ${fund.value.baseToken.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`,
        display: true,
      }
    }
    return true;
  },
];

const depositRequestAmountFormatted = computed(() => {
  const baseToken = fundStore.fund?.baseToken;
  if (!userDepositRequest?.value?.amount || !baseToken) return "N/A"
  return formatTokenValue(userDepositRequest?.value?.amount, baseToken.decimals, false);
});

const isAnythingLoading = computed(() => {
  // Object.values returns an array of values from the actions object
  // some() checks if at least one element passes the test implemented by the provided function
  return (loadingRequestDeposit.value || loadingApproveAllowance.value);
});

const isRequestDepositDisabled = computed(() => {
  return errorMessages.value.length > 0 || isAnythingLoading.value;
});

const errorMessages = computed<IError[]>(() => {
  // Disable deposit button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value)).filter(rule => rule !== true) as IError[];
});
const visibleErrorMessages = computed<IError[]>( () => {
  return errorMessages.value.filter((error: IError) => error.display)
})
const tokensWei = computed( () => {
  if (!fund.value?.baseToken) return 0n;
  return ethers.parseUnits(tokenValue.value, fund.value?.baseToken.decimals)
})

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if (error?.code === 4001) {
    toastStore.addToast("Transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
  }
  loadingRequestDeposit.value = false;
  loadingApproveAllowance.value = false;
  fundStore.fetchUserBalances();
}

/**
 * Sending a transaction and listening to the events.
 * https://docs.web3js.org/guides/wallet/transactions#sending-a-transaction-and-listening-to-the-events
 */
const requestDeposit = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to request deposit.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  console.log("REQUEST DEPOSIT");
  loadingRequestDeposit.value = true;

  console.log("Request deposit tokensWei: ", tokensWei.value, "from : ", accountStore.activeAccount.address);

  const ABI = [ "function requestDeposit(uint256 amount)" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("requestDeposit", [ tokensWei.value ]);
  const [gasPrice, gasEstimate] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
      gas: gasEstimate,
      gasPrice,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: ", hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt :", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit request was successful.");
        // Set form token value to user's current balance + current deposit request value so that
        // he can approve it without inputting the value himself, for better UX.
        // TODO takes 15-20 sec for node to sync .. fix
        // await fundStore.fetchUserBalances();
        fundStore.userDepositRequest = {
          amount: tokensWei.value,
          timestamp: Date.now(),
          type: FundTransactionType.Deposit,
        }
      } else {
        toastStore.errorToast("Your deposit request has failed. Please contact the Rethink Finance support.");
        fundStore.fetchUserBalances();
      }
      loadingRequestDeposit.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
};

const setTokenValueToDepositRequestAmount = () => {
  tokenValue.value = depositRequestAmountFormatted.value;
}
const approveAllowance = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to approve allowance.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  console.log("APPROVE ALLOWANCE");
  loadingApproveAllowance.value = true;

  console.log("Approve allowance tokensWei: ", tokensWei.value, "from : ", accountStore.activeAccount.address);
  const allowanceValue = tokensWei.value;

  try {
    // call the approval method
    await fundStore.fundBaseTokenContract.methods.approve(fund.value.address, tokensWei.value).send({
      from: accountStore.activeAccount.address,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt :", receipt);

      if (receipt.status) {
        toastStore.successToast("The approval was successful. You can make the deposit now.");

        // Refresh allowance value.
        fundStore.userFundAllowance = allowanceValue;
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }
      loadingApproveAllowance.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}

const showApproveAllowanceWarning = computed(() => {
  // User deposit request exists and allowance is bigger.
  return shouldUserApproveAllowance.value && tokensWei.value < (userDepositRequest?.value?.amount || 0n)
});


const buttons = ref([
  {
    name: "Request Deposit",
    onClick: requestDeposit,
    isVisible: shouldUserRequestDeposit,
    disabled: isRequestDepositDisabled,
    loading: loadingRequestDeposit,
    tooltipText: computed(() => {
      if (userDepositRequestExists.value) {
        return "Deposit request already exists. To change it, you first have to cancel the existing one."
      }
      return ""
    }),
  },
  {
    name: "Approve",
    onClick: approveAllowance,
    disabled: isRequestDepositDisabled,
    loading: loadingApproveAllowance,
    isVisible: shouldUserApproveAllowance,
    tooltipText: undefined,
  },
]);
</script>

<style lang="scss" scoped>
.deposit_button_group {
  gap: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;
}
.set_approve_allowance_button {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
</style>
