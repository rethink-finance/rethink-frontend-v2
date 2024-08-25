<template>
  <div class="flows">
    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          Settlement Cycle
        </div>
      </UiHeader>

      <UiDataBar bg-transparent>
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
          <div class="switch_to_zodiac_notification">
            <img
              src="@/assets/images/zodiac_pilot.svg"
              class="img_zodiac_pilot"
            >
            <template v-if="isUsingZodiacPilotExtension">
              <div>
                Connected to the Zodiac Pilot
              </div>
              <Icon
                icon="octicon:check-circle-fill-16"
                width="1rem"
                height="1rem"
                color="var(--color-success)"
              />
            </template>
            <div v-else>
              Switch to the Zodiac Pilot extension to complete the transfer and settle flows.
            </div>
          </div>
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
            <v-progress-circular
              v-if="isNavSimulationLoading"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />
            <div v-else-if="fund.pendingRedemptionBalanceError" class="text-error">
              N/A
            </div>
            <div
              v-else
              class="nav_simulated_value"
              :class="{'nav_simulated_value--warning': isAnySimulatedNavError}"
            >
              {{ formatNAV(totalCurrentSimulatedNAV) }}
              <div
                v-if="isAnySimulatedNavError"
                class="ms-2 justify-center align-center d-flex"
              >
                <Icon icon="octicon:question-16" width="1rem" color="var(--color-warning)" />
                <v-tooltip activator="parent" location="right">
                  Something went wrong while simulating NAV value. Retry simulating NAV.
                </v-tooltip>
              </div>
            </div>
          </div>
          <div class="data_bar__subtitle">
            Simulated NAV
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <v-progress-circular
              v-if="fund.pendingRedemptionBalanceLoading"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />
            <div v-else-if="fund.pendingRedemptionBalanceError" class="text-error">
              N/A
            </div>
            <template v-else>
              {{ pendingRedemptionBalanceFormatted }} {{ fund.fundToken.symbol }}
            </template>
          </div>
          <div class="data_bar__subtitle">
            Redemption Requests
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <v-progress-circular
              v-if="fund.pendingDepositBalanceLoading"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />
            <div v-else-if="fund.pendingDepositBalanceError" class="text-error">
              N/A
            </div>
            <template v-else>
              {{ pendingDepositBalanceFormatted }} {{ fund.baseToken.symbol }}
            </template>
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
            @click="refreshFlowsInfo()"
          >
            Refresh Flows Info
          </v-btn>
        </div>
      </UiDataBar>

      <!-- Fund Contract Balance & Update NAV and Settle flows -->
      <UiDataBar>
        <div class="data_bar__item">
          <div class="data_bar__title">
            {{ formatTokenValue(fund.fundContractBaseTokenBalance, fund.baseToken.decimals) }} {{ fund.baseToken.symbol }}
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
import { formatTokenValue } from "~/composables/formatters";

const fundStore = useFundStore();

const fund = useAttrs().fund as IFund;
const {
  formatNAV,
  totalCurrentSimulatedNAV,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
  isNavSimulationLoading,
} = toRefs(fundStore);


const fundingGap = computed(() => {
  // Difference between fund contract liquidity and amount of redemption requests.
  return 1
});

const isUsingZodiacPilotExtension = computed(() => {
  // Check if user is using Zodiac Pilot extension.
  // The connected wallet address is the same as custody (safe address).
  return fundStore.activeAccountAddress === fund?.safeAddress;
});
const simulatedNavErrorCount = computed(() => {
  return fundLastNAVUpdateMethods.value.reduce(
    (errorCount: number, method: any) => {
      return errorCount + method.isSimulatedNavError ? 1 : 0;
    },
    0,
  )
});
const isAnySimulatedNavError = computed(() => {
  return simulatedNavErrorCount.value > 0;
});

const pendingDepositBalanceFormatted = computed(() => {
  if (!fund?.pendingDepositBalance) return 0;
  return formatTokenValue(fund?.pendingDepositBalance, fund.baseToken.decimals, false)
});
const pendingRedemptionBalanceFormatted = computed(() => {
  if (!fund?.pendingRedemptionBalance) return 0;
  return formatTokenValue(fund?.pendingRedemptionBalance, fund.fundToken.decimals, false)
});

// TODO convert Redemption Requests to baseToken based on the current (simulated NAV) exch rate.
const refreshFlowsInfo = () => {
  // Refresh simulated NAV
  fundStore.simulateCurrentNAV();

  // refresh Deposit & Redemption Requests
  fundStore.fetchFundPendingDepositRedemptionBalance();

  // TODO refresh fund.fundContractBaseTokenBalance
};

watch(
  () => fundStore.fundLastNAVUpdateMethods,
  () => {
    console.warn("simulateCurrentNAV changed:")
    fundStore.simulateCurrentNAV();
  },
);
</script>

<style scoped lang="scss">
.fund_contract_notification {
  @include sm {
    max-width: 420px;
  }
}
.switch_to_zodiac_notification {
  align-items: center;
  display: flex;
  border: 1px solid $color-border-dark;
  background: $color-gray-light-transparent;
  padding: 1rem;
  flex-direction: row;
  border-radius: $default-border-radius;
  font-weight: 600;
  gap: 0.6rem;
}
.nav_simulated_value {
  display: flex;
  align-items: center;
  &--warning {
    color: $color-warning;
  }
}
</style>
