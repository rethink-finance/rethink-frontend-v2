<template>
  <FundSettlementBaseForm
    v-model="tokenValue"
    :token0="fundStore.fund.baseToken"
    :token1="fundStore.fund.fundToken"
    :token0-user-balance="fundStore.userBaseTokenBalance"
    :token1-user-balance="fundStore.userFundTokenBalance"
  >
    <template #buttons>
      <template v-if="accountsStore.isConnected">
        <div class="request_deposit__button">
          <div class="request_deposit__button_group">
            <v-btn
              v-for="button in buttons"
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

          </div>
          <div v-if="errorMessages && tokenValueChanged" class="text-red mt-4 text-center">
            <div v-for="error in visibleErrorMessages">
              {{ error.message }}
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="request_deposit__button">
          <v-btn class="bg-primary text-secondary" @click="accountsStore.connectWallet()">
            Connect Wallet
          </v-btn>
        </div>
      </template>
    </template>
  </FundSettlementBaseForm>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { computed, ref } from "vue";
import { useAccountsStore } from "~/store/accounts.store";
import { useFundStore } from "~/store/fund.store";
import type IFund from "~/types/fund";
import { useToastStore } from "~/store/toast.store";

const toastStore = useToastStore();
const accountsStore = useAccountsStore();
const fundStore = useFundStore();
const tokenValue = ref("0");
const tokenValueChanged = ref(false);
const fund: IFund = fundStore.fund;

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
    const valueWei = ethers.parseUnits(value, fund.baseToken.decimals);
    if (valueWei <= 0) return { message: "Value must be positive.", display: false }

    console.log("check wei: ", valueWei, fundStore.userBaseTokenBalance);
    if (fundStore.userBaseTokenBalance < valueWei) {
      const userBaseTokenBalanceFormatted = formatTokenValue(fundStore.userBaseTokenBalance, fund.baseToken.decimals);
      return {
        message: `Your ${fund.baseToken.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`,
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

const isDepositDisabled = computed(() => {
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
    toastStore.addToast("Deposit request transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
  }
  loadingRequestDeposit.value = false;
  loadingApproveAllowance.value = false;
  loadingDeposit.value = false;
  loadingCancelDeposit.value = false;
}

const requestDeposit = async () => {
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to request deposit.")
    return;
  }
  console.log("REQUEST DEPOSIT");
  loadingRequestDeposit.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.baseToken.decimals)
  console.log("Request deposit tokensWei: ", tokensWei, "from : ", accountsStore.activeAccount.address);

  try {
    const resp = await fundStore.fundContract.methods.requestDeposit(
      tokensWei,
    ).send({
      from: accountsStore.activeAccount.address,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt :", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit request was successful.");
        tokenValue.value = "0";
      } else {
        toastStore.errorToast("Your deposit request has failed. Please contact the Rethink Finance support.");
      }

      loadingRequestDeposit.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
    console.log("resp: ", resp);
  } catch (error: any) {
    handleError(error);
  }
};


const approveAllowance = async () => {
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to approve allowance.")
    return;
  }
  console.log("APPROVE ALLOWANCE");
  loadingApproveAllowance.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.baseToken.decimals)
  console.log("Approve allowance tokensWei: ", tokensWei, "from : ", accountsStore.activeAccount.address);
  const allowanceValue = tokensWei;

  try {
    // call the approve method
    await fundStore.fundBaseTokenContract.methods.approve(fund.address, tokensWei).send({
      from: accountsStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log(receipt);

      if (receipt.status) {
        toastStore.successToast("The approval was successfull. You can make the deposit now.");

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
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the fund.")
    return;
  }
  console.log("DEPOSIT");
  loadingDeposit.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.baseToken.decimals)
  console.log("Deposit tokensWei: ", tokensWei, "from : ", accountsStore.activeAccount.address);

  try {
    await fundStore.fundContract.methods.deposit().send({
      from: accountsStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit was successfull.");

        // Refresh user balances & allowance.
        fundStore.fetchUserBalances();

        tokenValue.value = "0";
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
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to cancel the deposit.")
    return;
  }
  console.log("Cancel Deposit");
  loadingCancelDeposit.value = true;

  try {
    await fundStore.fundContract.methods.revokeDepositWithrawal(
      1,
    ).send({
      from: accountsStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit request was successfull.");
        tokenValue.value = "0";
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
    disabled: isDepositDisabled,
    loading: loadingRequestDeposit,
  },
  {
    name: "Approve",
    onClick: approveAllowance,
    disabled: isDepositDisabled,
    loading: loadingApproveAllowance,
  },
  {
    name: "Cancel Deposit",
    onClick: cancelDeposit,
    disabled: isAnythingLoading,
    loading: loadingCancelDeposit,
  },
  {
    name: "Deposit",
    onClick: deposit,
    disabled: isDepositDisabled,
    loading: loadingDeposit,
  },
]);
</script>

<style lang="scss" scoped>
.request_deposit__button_group {
  gap: 1rem;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}
</style>
