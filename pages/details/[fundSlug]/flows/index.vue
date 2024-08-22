<template>
  <div class="flows">
    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          Settlement Cycle
        </div>
      </UiHeader>

      <UiDataBar>
        <div class="data_bar__item">
          <div class="data_bar__title">
            {{ fundLastNAVUpdate?.date || "N/A" }}
          </div>
          <div class="data_bar__subtitle">
            Last Settlement
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            {{ fund.plannedSettlementPeriod || "N/A" }}
          </div>
          <div class="data_bar__subtitle">
            Planned Settlement Cycle
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <!-- TODO figure it out -->
            N/A
          </div>
          <div class="data_bar__subtitle">
            Next Planned Settlement
          </div>
        </div>
        <div class="data_bar__item">
          <v-btn
            class="button"
            variant="outlined"
          >
            Switch To Zodiac Pilot
          </v-btn>
        </div>
      </UiDataBar>
    </div>

    <!-- Fund Contract -->
    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          Fund Contract
        </div>
      </UiHeader>

      <!--Simulated NAV & redemption & deposit requests-->
      <UiDataBar>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <!-- TODO figure it out -->
            N/A
          </div>
          <div class="data_bar__subtitle">
            Simulated NAV
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <!-- TODO figure it out -->
            N/A
          </div>
          <div class="data_bar__subtitle">
            Redemption Requests
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <!-- TODO figure it out -->
            N/A
          </div>
          <div class="data_bar__subtitle">
            Deposit Rquests
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <!-- TODO figure it out -->
            N/A
          </div>
          <div class="data_bar__subtitle">
            Funding Gap
          </div>
        </div>
        <div class="data_bar__item">
          <v-btn
            class="text-secondary"
            variant="outlined"
          >
            Refresh Flows Info
          </v-btn>
        </div>
      </UiDataBar>

      <!-- Fund Contract Balance & Update NAV and Settle flows -->
      <UiDataBar>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <!-- TODO figure it out -->
            N/A
          </div>
          <div class="data_bar__subtitle">
            Fund Contract Balance
          </div>
        </div>
        <div class="data_bar__item">
          <UiNotification class="fund_contract_notification">
            Fund Contract Balance should meet Redemption Requests before being able to Settle the Flows.
          </UiNotification>
        </div>
        <div class="data_bar__item">
          <v-btn>
            Update NAV and Settle Flows
          </v-btn>
        </div>
      </UiDataBar>
    </div>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund.store";

const router = useRouter();
const fundStore = useFundStore();

const fund = useAttrs().fund as IFund;
const { selectedFundSlug, fundLastNAVUpdate } = toRefs(fundStore);


const fundingGap = computed(() => {
  // Difference between fund contract liquidity and amount of redemption requests.
  return 1
});


const refreshFlowsInfo = () => {
  // TODO refresh simulated NAV

  // refresh Deposit & Redemption Requests
  fundStore.fetchFundPendingDepositRedemptionBalance();
};

const navigateToCreatePermissions = () => {
  router.push(
    `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
  );
};
</script>

<style scoped lang="scss">
.fund_contract_notification {
  @include sm {
    max-width: 420px;
  }
}
</style>
