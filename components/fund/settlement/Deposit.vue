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
          <v-tooltip
            v-for="(button, index) in buttons"
            :key="index"
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

const toastStore = useToastStore();
const accountStore = useAccountStore();
const fundStore = useFundStore();
const tokenValue = ref("0.0");
const tokenValueChanged = ref(false);
const fund = computed(() => fundStore.fund);

const loadingRequestDeposit = ref(false);
const loadingApproveAllowance = ref(false);
const loadingDeposit = ref(false);
const loadingCancelDeposit = ref(false);

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

    console.log("[REDEEM] check user base token balance wei: ", valueWei, fundStore.userBaseTokenBalance);
    if (fundStore.userBaseTokenBalance < valueWei) {
      const userBaseTokenBalanceFormatted = formatTokenValue(fundStore.userBaseTokenBalance, fund.value.baseToken.decimals);
      return {
        message: `Your ${fund.value.baseToken.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`,
        display: true,
      }
    }
    return true;
  },
];

const isAnythingLoading = computed(() => {
  // Object.values returns an array of values from the actions object
  // some() checks if at least one element passes the test implemented by the provided function
  return (loadingRequestDeposit.value || loadingApproveAllowance.value || loadingDeposit.value || loadingCancelDeposit.value);
});

const isEnoughAllowance = computed(() => {
  if (!fund.value) return false;
  const valueWei = ethers.parseUnits(tokenValue.value, fund.value.baseToken.decimals);
  return valueWei <= fundStore.userFundAllowance;
});
const isDepositDisabled = computed(() => {
  // Disable deposit button if any of rules is false.
  return errorMessages.value.length > 0 || isAnythingLoading.value || !isEnoughAllowance.value;
});
const isRequestDepositDisabled = computed(() => {
  // Disable deposit button if any of rules is false.
  return errorMessages.value.length > 0 || isAnythingLoading.value;
});

const errorMessages = computed<IError[]>(() => {
  // Disable deposit button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value)).filter(rule => rule !== true) as IError[];
});
const visibleErrorMessages = computed<IError[]>( () => {
  return errorMessages.value.filter((error: IError) => error.display)
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
  loadingDeposit.value = false;
  loadingCancelDeposit.value = false;
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

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.value.baseToken.decimals)
  console.log("Request deposit tokensWei: ", tokensWei, "from : ", accountStore.activeAccount.address);

  const ABI = [ "function requestDeposit(uint256 amount)" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("requestDeposit", [ tokensWei ]);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: ", hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt :", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit request was successful.");
        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("Your deposit request has failed. Please contact the Rethink Finance support.");
      }

      loadingRequestDeposit.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
};


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

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.value.baseToken.decimals)
  console.log("Approve allowance tokensWei: ", tokensWei, "from : ", accountStore.activeAccount.address);
  const allowanceValue = tokensWei;

  try {
    // call the approve method
    await fundStore.fundBaseTokenContract.methods.approve(fund.value.address, tokensWei).send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt :", receipt);

      if (receipt.status) {
        toastStore.successToast("The approval was successful. You can make the deposit now.");

        // refresh values
        // needs to be updated this way because Polygon RPC nodes are slow with updating state
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


const deposit = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the fund.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  console.log("DEPOSIT");
  loadingDeposit.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.value.baseToken.decimals)
  console.log("Deposit tokensWei: ", tokensWei, "from : ", accountStore.activeAccount.address);

  const ABI = [ "function deposit()" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("deposit");

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit was successful.");

        // Refresh user balances & allowance.
        fundStore.fetchUserBalances();
        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingDeposit.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}


const cancelDeposit = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to cancel the deposit.")
    return;
  }
  console.log("Cancel Deposit");
  loadingCancelDeposit.value = true;

  const ABI = [ "function revokeDepositWithrawal(bool isDeposit)" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("revokeDepositWithrawal", [ true ]);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit request was successful.");
        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("Your deposit request has failed. Please contact the Rethink Finance support.");
      }
      loadingCancelDeposit.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}

const buttons = ref([
  {
    name: "Request Deposit",
    onClick: requestDeposit,
    disabled: isRequestDepositDisabled,
    loading: loadingRequestDeposit,
    tooltipText: undefined,
  },
  {
    name: "Approve",
    onClick: approveAllowance,
    disabled: isRequestDepositDisabled,
    loading: loadingApproveAllowance,
    tooltipText: undefined,
  },
  {
    name: "Cancel Deposit",
    onClick: cancelDeposit,
    disabled: isAnythingLoading,
    loading: loadingCancelDeposit,
    tooltipText: undefined,
  },
  {
    name: "Deposit",
    onClick: deposit,
    disabled: isDepositDisabled,
    loading: loadingDeposit,
    tooltipText: computed(() => !isEnoughAllowance.value ? "Not enough allowance." : undefined),
  },
]);
</script>

<style lang="scss" scoped>
.deposit_button_group {
  gap: 1rem;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}
</style>
