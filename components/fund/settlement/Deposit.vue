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
          <v-progress-circular
            v-if="loading"
            color="primary"
            class="d-flex"
            indeterminate
          />
          <div v-else class="request_deposit__button_group">
            <v-btn
              :loading="loading"
              class="bg-primary text-secondary"
              :disabled="isRequestDepositDisabled"
              @click="requestDeposit"
            >
              Request Deposit
            </v-btn>
            <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="approveAllowance">
              Approve
            </v-btn>
            <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="deposit">
              Cancel Deposit
            </v-btn>
            <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="deposit">
              Deposit
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
const loading = ref(false);

const fund: IFund = fundStore.fund;

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

const isDepositDisabled = computed(() => {
  // Disable deposit button if any of rules is false.
  return errorMessages.value.length > 0;
});

const isRequestDepositDisabled = computed(() => {
  return errorMessages.value.length > 0;
});

const errorMessages = computed<IError[]>(() => {
  // Disable deposit button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value)).filter(rule => rule !== true) as IError[];
});
const visibleErrorMessages = computed<IError[]>( () => {
  return errorMessages.value.filter((error: IError) => error.display)
})

const requestDeposit = async () => {
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to request deposit.")
    return;
  }
  console.log("REQUEST DEPOSIT");
  loading.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.baseToken.decimals)
  console.log("Request deposit tokensWei: ", tokensWei, "from : ", accountsStore.activeAccount.address);

  try {
    const resp = await fundStore.fundContract.methods.requestDeposit(
      tokensWei,
    ).send({
      from: accountsStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
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

      loading.value = false;
    }).on("error", (error: any) => {
      console.error(error);
      loading.value = false;
      toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    });
    console.log("resp: ", resp);
  } catch (error: any) {
    // Check Metamask errors:
    // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
    if (error?.code === 4001) {
      toastStore.addToast("Deposit request transaction was rejected.")
    } else {
      toastStore.addToast("Oops, something went wrong with your transaction.")
      console.error(error);
    }
    loading.value = false;
  }
};


const deposit = async () => {
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the fund.")
    return;
  }
  console.log("DEPOSIT");
  loading.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.baseToken.decimals)
  console.log("Deposit tokensWei: ", tokensWei, "from : ", accountsStore.activeAccount.address);

  try {
    await fundStore.fundContract.methods.deposit().send({
      from: accountsStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", function(hash: string){
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", function(receipt: any){
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast("Your deposit was successfull.");

        // Refresh user balances & allowance.
        fundStore.fetchUserBalances();

        tokenValue.value = "0";
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loading.value = false;
    }).on("error", function(error: any){
      console.error("deposit error: ", error);
      loading.value = false;
      toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    });
  } catch (error: any) {
    console.error(error);
  }
}

const approveAllowance = async () => {
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the fund.")
    return;
  }
  console.log("APPROVE ALLOWANCE");
  loading.value = true;

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
      loading.value = false;
    }).on("error", (error: any) => {
      console.error(error);
      loading.value = false;
      toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    });
  } catch (error: any) {
    console.error(error);
  }
}



</script>

<style lang="scss" scoped>
.request_deposit__button_group {
  gap: 1rem;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}
</style>
