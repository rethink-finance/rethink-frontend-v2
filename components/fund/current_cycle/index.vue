<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div>
        <div class="section_title">
          Current Cycle
        </div>
      </div>
      <div class="fund_settlement__buttons">
        <v-btn
          @click="claimTokens"
        >
          Process Request
          <v-tooltip activator="parent" location="bottom">
            Process Request.
          </v-tooltip>
        </v-btn>
      </div>
    </div>
    <div v-if="userDepositRequest || userWithdrawalRequest" class="fund_settlement__pending_requests">
      <FundCurrentCyclePendingRequest
        v-if="userDepositRequest"
        :fund-transaction-request="userDepositRequest"
        :exchange-rate="baseToFundTokenExchangeRate"
        :token0="fund.baseToken"
        :token1="fund.fundToken"
      />
      <FundCurrentCyclePendingRequest
        v-if="userWithdrawalRequest"
        :fund-transaction-request="userWithdrawalRequest"
        :exchange-rate="fundToBaseTokenExchangeRate"
        :token1="fund.baseToken"
        :token0="fund.fundToken"
      />
    </div>
    <div v-else class="fund_settlement__no_pending_requests">
      Currently there are no deposit or withdrawal requests.
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useToastStore } from "~/store/toast.store";
import { useFundStore } from "~/store/fund.store";

const toastStore = useToastStore()
const fundStore = useFundStore()
const {
  userFundAllowance,
  userFundTokenBalance,
  userBaseTokenBalance,
  userDepositRequest,
  userWithdrawalRequest,
  baseToFundTokenExchangeRate,
  fundToBaseTokenExchangeRate,
} = toRefs(fundStore);

defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => {},
  },
})

const claimTokens = () => {
  toastStore.addToast("Claim " + userDepositRequest);
  console.log("userBaseTokenBalance: ", toRaw(userBaseTokenBalance))
  console.log("userFundTokenBalance: ", toRaw(userFundTokenBalance))
  console.log("userFundAllowance: ", toRaw(userFundAllowance))
  console.log("userDepositRequest: ", toRaw(userDepositRequest))
  console.log("userWithdrawalRequest: ", toRaw(userWithdrawalRequest))
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
