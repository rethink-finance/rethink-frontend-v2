<template>
  <div class="fund_details">
    <FundOverview :fund="fund" />

    <div class="main_card">
      <FundInfo :fund="fund" />
    </div>

    <div class="d-flex flex-column">
      <div class="main_card main_grid order-1 order-sm-0">
        <FundChart :fund="fund" />
        <FundCurrentCycle
          v-if="userDepositRequestExists || userRedemptionRequestExists"
          :fund="fund"
        />
        <FundSettlement
          v-else
          :fund="fund"
          :should-user-delegate="shouldUserDelegate"
        />
      </div>
    </div>

    <!-- Activity moved to a separate component -->
    <FundActivity v-if="fund.chainId !== ChainId.ARBITRUM" :fund="fund" />
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import type IFund from "~/types/fund";
import { ChainId } from "~/types/enums/chain_id";

const fundStore = useFundStore();
const {
  shouldUserDelegate,
  userDepositRequestExists,
  userRedemptionRequestExists,
} = storeToRefs(fundStore);

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss">
</style>
