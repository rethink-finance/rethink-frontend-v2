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
            <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="deposit">
              Approve
            </v-btn>
            <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="deposit">
              Cancel Deposit
            </v-btn>
            <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="deposit">
              Deposit
            </v-btn>
          </div>
          <div v-if="errorMessages" class="text-red mt-4 text-center">
            <div v-for="error in errorMessages">
              {{ error }}
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
const loading = ref(false);

const fund: IFund = fundStore.fund;

const rules = [
  (value: string): boolean | string => {
    const valueWei = ethers.parseUnits(value, fund.baseToken.decimals);
    console.log("check wei: ", valueWei, fundStore.userBaseTokenBalance);
    if (fundStore.userBaseTokenBalance < valueWei) {
      const userBaseTokenBalanceFormatted = formatTokenValue(fundStore.userBaseTokenBalance, fund.baseToken.decimals);
      return `Your ${fund.baseToken.symbol} balance is too low. Try ${userBaseTokenBalanceFormatted}`
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

const errorMessages = computed<string []>(() => {
  // Disable deposit button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value)).filter(rule => rule !== true) as string[];
});


const requestDeposit = async () => {
  if (!accountsStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to request deposit.")
    return;
  }
  console.log("REQUEST DEPOSIT");
  loading.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.baseToken.decimals)
  console.log("Request deposit tokensWei: ", tokensWei, "from : ", accountsStore.activeAccount.address);

  // make a deposit request
  // const fundStorefundContract = new fundStore.web3.eth.Contract(GovernableFund.abi, fundStore.selectedFundAddress)
  // console.log(fundStorefundContract.methods);

  // const rec = fundStore.fundContract.methods.requestDeposit(
  //   tokensWei,
  // ).send({
  //   from: accountsStore.activeAccount.address,
  //   maxPriorityFeePerGas: undefined,
  //   maxFeePerGas: undefined,
  // })
  await fundStore.fundContract.methods.requestDeposit(
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

    loading.value = false;

  }).on("error", (error: any) => {
    console.error(error);
    loading.value = false;
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
  });
};

const deposit = () => {
  console.log("DEPOSIT");
};

</script>

<style lang="scss" scoped>
.request_deposit__button_group {
  gap: 1rem;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}
</style>
