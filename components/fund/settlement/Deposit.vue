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
          <v-btn class="bg-primary text-secondary" :disabled="isDepositDisabled" @click="deposit">
            Deposit
          </v-btn>
          <div v-if="errorMessages" class="text-red mt-4">
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

const accountsStore = useAccountsStore();
const fundStore = useFundStore();
const tokenValue = ref("0");

const fund: IFund = fundStore.fund;

const rules = [
  (value: string): boolean | string => {
    const valueWei = ethers.parseUnits(value, fund.baseToken.decimals);
    console.log("check wei: ", valueWei, fundStore.userBaseTokenBalance);
    if (fundStore.userBaseTokenBalance < valueWei) {
      console.log("LOW LOW LOW : ");
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

const errorMessages = computed<string []>(() => {
  // Disable deposit button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value)).filter(rule => rule !== true) as string[];
});
const deposit = () => {
  console.log("DEPOSIT");
};

</script>

<style lang="scss" scoped>

</style>
