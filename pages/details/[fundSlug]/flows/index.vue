<template>
  <div class="flows">
    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          Settlement Cycle
          <UiTooltipClick location="right" :hide-after="6000">
            <Icon
              icon="material-symbols:info-outline"
              :class="'main_header__info-icon'"
              width="1.5rem"
            />

            <template #tooltip>
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon icon="maki:arrow" color="primary" width="1rem" />
              </a>
            </template>
          </UiTooltipClick>
        </div>
      </UiHeader>

      <UiDataBar bg-transparent class="settlement_cycle data_bar">
        <div class="data_bar__item">
          <div class="data_bar__title">
            <v-progress-circular
              v-if="isLoadingFetchFundNAVUpdatesAction"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />
            <template v-else>
              {{ fundLastNAVUpdate?.date || "N/A" }}
            </template>
          </div>
          <div class="data_bar__subtitle">
            Last Settlement
          </div>
        </div>
        <div class="data_bar__item">
          <div class="data_bar__title">
            <v-progress-circular
              v-if="isLoadingParsedPlannedSettlement"
              class="d-flex"
              size="18"
              width="2"
              indeterminate
            />

            <template v-else>
              {{ parsedPlannedSettlement }}
            </template>
          </div>
          <div class="data_bar__subtitle">
            Planned Settlement Cycle
          </div>
        </div>
        <!-- TODO figure out Next Planned Settlement -->
        <!--        <div class="data_bar__item">-->
        <!--          <div class="data_bar__title">-->
        <!--            N/A-->
        <!--          </div>-->
        <!--          <div class="data_bar__subtitle">-->
        <!--            Next Planned Settlement-->
        <!--          </div>-->
        <!--        </div>-->
        <div class="data_bar__item">
          <div class="switch_to_zodiac_notification">
            <img
              src="@/assets/images/zodiac_pilot.svg"
              class="img_zodiac_pilot"
            >
            <template v-if="isUsingZodiacPilotExtension">
              <div>Connected to the Zodiac Pilot</div>
              <Icon
                icon="octicon:check-circle-fill-16"
                width="1rem"
                height="1rem"
                color="var(--color-success)"
              />
            </template>
            <div v-else>
              Switch to the Zodiac Pilot extension to complete the transfer and
              settle flows.
            </div>
          </div>
        </div>
      </UiDataBar>
    </div>

    <!-- Fund Contract -->
    <div class="main_card">
      <UiHeader>
        <div class="main_header__title">
          OIV Contract
          <UiTooltipClick location="right" :hide-after="6000">
            <Icon
              icon="material-symbols:info-outline"
              :class="'main_header__info-icon'"
              width="1.5rem"
            />

            <template #tooltip>
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon icon="maki:arrow" color="primary" width="1rem" />
              </a>
            </template>
          </UiTooltipClick>
        </div>
      </UiHeader>

      <!--Simulated NAV & redemption & deposit requests-->
      <UiDataBar>
        <div class="column-8">
          <div class="data_bar__item">
            <div class="data_bar__title">
              <v-progress-circular
                v-if="isLoadingFetchFundNAVUpdatesAction ||
                  isLoadingFetchSimulatedNAVMethodValueAction ||
                  isLoadingFetchSimulateCurrentNAVAction"
                class="d-flex"
                size="18"
                width="2"
                indeterminate
              />
              <div
                v-else-if="fund.pendingRedemptionBalanceError"
                class="text-error"
              >
                N/A
              </div>
              <div
                v-else
                class="nav_simulated_value"
                :class="{
                  'nav_simulated_value--warning': isAnySimulatedNavError,
                }"
              >
                <div v-if="isSimulatedNAVEdit" class="transfer__token">
                  <div class="transfer__token_data">
                    <div class="transfer__token_col px-4">
                      {{ fundStore.fund?.baseToken?.symbol }}
                    </div>
                    <div
                      class="transfer__token_col transfer__input pa-0 transfer__token_col--dark text-end"
                    >
                      <UiInputNumber
                        v-model="customSimulatedNAVValue"
                        :rules="customSimulatedNAVValueRules"
                        class="transfer__input_amount"
                        hide-details
                        @input="customSimulatedNAVValueChanged = true"
                      />
                    </div>
                  </div>
                </div>
                <template v-else>
                  {{ totalCurrentSimulatedNAVFormatted }}
                </template>
                <div
                  v-if="isAnySimulatedNavError"
                  class="ms-2 justify-center align-center d-flex"
                >
                  <Icon
                    icon="octicon:question-16"
                    width="1rem"
                    color="var(--color-warning)"
                  />
                  <v-tooltip activator="parent" location="right">
                    Something went wrong while simulating NAV value. Retry
                    simulating NAV.
                  </v-tooltip>
                </div>
              </div>
            </div>
            <div class="data_bar__subtitle d-flex">
              Simulated NAV
              <UiDetailsButton
                v-if="!isSimulatedNAVEdit"
                class="ms-2"
                xs
                @click="toggleSimulatedNAVEdit()"
              >
                <Icon icon="fa-solid:edit" width="1.4em" height="1.4em" />
              </UiDetailsButton>
              <UiDetailsButton
                v-else
                class="ms-2"
                xs
                @click="toggleSimulatedNAVEdit()"
              >
                <Icon
                  icon="mdi-arrow-u-left-top"
                  width="1.4em"
                  height="1.4em"
                />
              </UiDetailsButton>
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
              <div
                v-else-if="fund.pendingRedemptionBalanceError"
                class="text-error"
              >
                N/A
              </div>
              <template v-else>
                {{ pendingRedemptionBalanceFormatted }}
                {{ fund.fundToken.symbol }}
                <div class="pending_redemptions_estimate">
                  ≈
                  <v-progress-circular
                    v-if="isLoadingFetchFundNAVUpdatesAction ||
                      isLoadingFetchSimulatedNAVMethodValueAction ||
                      isLoadingFetchSimulateCurrentNAVAction"
                    class="d-flex"
                    size="18"
                    width="2"
                    indeterminate
                  />
                  <template v-else>
                    {{ estimatedPendingRedemptionBalanceInBaseFormatted }}
                  </template>
                </div>
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
              <div
                v-else-if="fund.pendingDepositBalanceError"
                class="text-error"
              >
                N/A
              </div>
              <template v-else>
                {{ pendingDepositBalanceFormatted }} {{ fund.baseToken.symbol }}
              </template>
            </div>
            <div class="data_bar__subtitle">
              Deposit Requests
            </div>
          </div>
          <div class="data_bar__item">
            <div class="data_bar__title">
              <v-progress-circular
                v-if="
                  isLoadingFetchFundNAVUpdatesAction ||
                    isLoadingFetchSimulatedNAVMethodValueAction ||
                    isLoadingFetchSimulateCurrentNAVAction
                "
                class="d-flex"
                size="18"
                width="2"
                indeterminate
              />
              <div
                v-else-if="fund.pendingRedemptionBalanceError"
                class="text-error"
              >
                N/A
              </div>
              <div
                v-else
                class="funding_gap"
                :class="fundingGapClass"
                @click="setTransferToFundValue(absoluteFundingGap)"
              >
                {{ fundingGapFormatted }}
              </div>
            </div>
            <div class="data_bar__subtitle">
              Funding Gap
            </div>
          </div>
        </div>
        <div class="column-4">
          <div class="data_bar__item">
            <v-btn
              class="text-secondary"
              variant="outlined"
              @click="refreshFlowsInfo()"
            >
              Refresh Flows Info
            </v-btn>
          </div>
        </div>
      </UiDataBar>

      <!-- Fund Contract Balance & Update NAV and Settle flows -->
      <UiDataBar>
        <div class="column-8">
          <div class="data_bar__item">
            <div class="title_balance">
              <v-progress-circular
                v-if="fund.fundContractBaseTokenBalanceLoading"
                class="d-flex"
                size="18"
                width="2"
                indeterminate
              />
              <div
                v-else-if="fund.fundContractBaseTokenBalanceError"
                class="text-error"
              >
                N/A
              </div>
              <template v-else>
                {{
                  formatTokenValue(
                    fund.fundContractBaseTokenBalance,
                    fund.baseToken.decimals,
                    false
                  )
                }}
                {{ fund.baseToken.symbol }}
              </template>
            </div>
            <div class="data_bar__subtitle">
              OIV Contract Balance
            </div>
          </div>
          <div class="data_bar__item">
            <UiNotification class="fund_contract_notification">
              OIV Contract Balance should meet Redemption Requests before being
              able to Settle the Flows.
            </UiNotification>
          </div>
        </div>
        <div class="column-4">
          <div class="data_bar__item">
            <v-tooltip
              activator="parent"
              location="bottom"
              :disabled="isUsingZodiacPilotExtension"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  :disabled="!isUsingZodiacPilotExtension || isLoadingPostUpdateNAV"
                  class="bg-primary text-secondary"
                  @click="fundStore.postUpdateNAV()"
                >
                  <template #prepend>
                    <v-progress-circular
                      v-if="isLoadingPostUpdateNAV"
                      class="d-flex"
                      size="20"
                      width="3"
                      indeterminate
                    />
                  </template>
                  Update NAV and Settle Flows
                </v-btn>
              </template>
              <template #default>
                Switch to the Zodiac Pilot Extension to Update NAV and Settle
                Flows.
              </template>
            </v-tooltip>
          </div>
        </div>
      </UiDataBar>
    </div>

    <div class="main_card main_grid">
      <FundSettlementTransferBaseAsset v-model="transferToFundValue" />
      <FundSettlementSweepFundContract />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers, FixedNumber } from "ethers";
import { formatTokenValue, roundToSignificantDecimals } from "~/composables/formatters";
import { parsePlannedSettlement } from "~/composables/fund/parsePlannedSettlement";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();

const fund = useAttrs().fund as IFund;
const {
  isUsingZodiacPilotExtension,
  totalCurrentSimulatedNAV,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
} = storeToRefs(fundStore);

const customSimulatedNAVValue = ref("");
const customSimulatedNAVValueChanged = ref(false);
const parsedPlannedSettlement = ref("");
const isLoadingParsedPlannedSettlement = ref(false);

watch(
  () => totalCurrentSimulatedNAV.value,
  () => {
    // If user has not yet updated the custom simulated NAV value, update it with the actual simulated NAV.
    if (!customSimulatedNAVValueChanged.value) {
      customSimulatedNAVValue.value = formatTokenValue(
        totalCurrentSimulatedNAV.value,
        fund.baseToken.decimals,
        false,
      );
    }
  },
  { immediate: true },
);
const customSimulatedNAVValueRules = [
  (value: string) => {
    let valueWei;
    try {
      valueWei = ethers.parseUnits(value || "0", fundStore.fund?.baseToken.decimals);
    } catch {
      return `Make sure the value has max ${fundStore.fund?.baseToken.decimals} decimals.`
    }
    if (valueWei <= 0) {
      return "Value must be positive.";
    }
    return true;
  },
];
const isSimulatedNAVEdit = ref(false);
const transferToFundValue = ref("");
const simulatedNavErrorCount = computed(() => {
  return fundLastNAVUpdateMethods.value.reduce(
    (errorCount: number, method: any) => {
      return errorCount + method.isSimulatedNavError ? 1 : 0;
    },
    0,
  );
});
const isAnySimulatedNavError = computed(() => {
  return simulatedNavErrorCount.value > 0;
});

const pendingDepositBalanceFormatted = computed(() => {
  if (!fund?.pendingDepositBalance) return "0";
  return formatTokenValue(
    fund?.pendingDepositBalance,
    fund.baseToken.decimals,
    false,
  );
});
const totalCurrentSimulatedNAVFormatted = computed(() => {
  if (!totalCurrentSimulatedNAV.value) return "0";
  return fundStore.getFormattedBaseTokenValue(totalCurrentSimulatedNAV.value);
});
const pendingRedemptionBalanceFormatted = computed(() => {
  if (!fund?.pendingRedemptionBalance) return "0";
  return formatTokenValue(
    fund?.pendingRedemptionBalance,
    fund.fundToken.decimals,
    false,
  );
});

const estimatedFundToBaseTokenExchangeRate = computed(
  (): FixedNumber | undefined => {
    // Estimated Fund to Base token exchange rate based on the current NAV simulated value or user's manual input.
    if (!fundStore.fund || !fundStore.fund?.fundTokenTotalSupply) {
      return undefined;
    }

    const fundTokenTotalSupply = FixedNumber.fromString(
      ethers.formatUnits(
        fundStore.fund?.fundTokenTotalSupply,
        fundStore.fund?.fundToken.decimals,
      ),
    );

    // If user is editing simulated NAV, take his value to calculate exchange rate.
    // Otherwise, take the fetched current simulated NAV value.
    let navValueString;
    if (isSimulatedNAVEdit.value) {
      navValueString = customSimulatedNAVValue.value;
    } else {
      navValueString = ethers.formatUnits(
        totalCurrentSimulatedNAV.value,
        fundStore.fund?.baseToken.decimals,
      );
    }
    const totalCurrentSimulatedNAVValue =
      FixedNumber.fromString(navValueString);

    return totalCurrentSimulatedNAVValue.div(fundTokenTotalSupply);
  },
);

const estimatedPendingRedemptionBalanceInBase = computed(() => {
  // Estimated Fund to Base token exchange rate based on the current NAV simulated value or user's manual input.
  if (
    !fundStore.fund ||
    estimatedFundToBaseTokenExchangeRate.value === undefined
  )
    return undefined;
  if (!fundStore.fund?.pendingRedemptionBalance)
    return FixedNumber.fromString("0");

  const pendingRedemptionBalance = FixedNumber.fromString(
    ethers.formatUnits(
      fundStore.fund?.pendingRedemptionBalance,
      fundStore.fund?.fundToken.decimals,
    ),
  );
  console.log(
    "actual value",
    pendingRedemptionBalance.mul(estimatedFundToBaseTokenExchangeRate.value),
  );

  // Calculate the estimated value using the exchange rate
  return pendingRedemptionBalance.mul(
    estimatedFundToBaseTokenExchangeRate.value,
  );
});
const estimatedPendingRedemptionBalanceInBaseFormatted = computed(() => {
  // Estimated Fund to Base token exchange rate based on the current NAV simulated value or user's manual input.
  if (
    !fundStore.fund ||
    !estimatedPendingRedemptionBalanceInBase.value ||
    estimatedPendingRedemptionBalanceInBase.value.isZero()
  ) {
    return "0 " + fundStore.fund?.baseToken.symbol;
  }

  console.log(
    "estimatedPendingRedemptionBalanceInBase",
    estimatedPendingRedemptionBalanceInBase.value,
  );

  // Calculate the estimated value using the exchange rate
  return (
    roundToSignificantDecimals(
      estimatedPendingRedemptionBalanceInBase.value.toString(),
    ) +
    " " +
    fundStore.fund.baseToken.symbol
  );
});

const fundingGap = computed(() => {
  if (
    !fundStore.fund ||
    estimatedPendingRedemptionBalanceInBase.value === undefined
  )
    return undefined;
  console.log(
    "FF estimatedPendingRedemptionBalanceInBase",
    estimatedPendingRedemptionBalanceInBase.value,
  );

  // Difference between fund contract liquidity and amount of redemption requests.
  let fundContractBaseTokenBalance = FixedNumber.fromString("0");
  if (fundStore.fund?.fundContractBaseTokenBalance) {
    fundContractBaseTokenBalance = FixedNumber.fromString(
      ethers.formatUnits(
        fundStore.fund?.fundContractBaseTokenBalance,
        fundStore.fund?.baseToken.decimals,
      ),
    );
  }
  return fundContractBaseTokenBalance.sub(
    estimatedPendingRedemptionBalanceInBase.value,
  );
});

const fundingGapFormatted = computed(() => {
  if (!fundStore.fund || fundingGap.value === undefined) return "N/A";
  return (
    roundToSignificantDecimals(fundingGap.value.toString()) +
    " " +
    fundStore.fund?.baseToken.symbol
  );
});
const absoluteFundingGap = computed(() => {
  if (!fundStore.fund || fundingGap.value === undefined) return "";
  return fundingGap.value.toString().replace("-", "");
});

const fundingGapClass = computed(() => {
  if (!fundStore.fund || fundingGap.value === undefined) return "";
  if (fundingGap.value.gt(FixedNumber.fromValue(0))) {
    return "text-success";
  } else if (fundingGap.value.lt(FixedNumber.fromValue(0))) {
    return "text-error";
  }
  return "";
});

const setTransferToFundValue = (value: any) => {
  transferToFundValue.value = value;
};
const toggleSimulatedNAVEdit = () => {
  isSimulatedNAVEdit.value = !isSimulatedNAVEdit.value;
};

const refreshFlowsInfo = () => {
  // Refresh current simulated NAV.
  fundStore.simulateCurrentNAV();

  // Refresh Deposit & Redemption Requests.
  fundStore.fetchFundPendingDepositRedemptionBalance();

  // Refresh fund contract base token balance.
  fundStore.fetchFundContractBaseTokenBalance();
};

watch(
  () => fundStore.fundLastNAVUpdateMethods,
  () => {
    fundStore.simulateCurrentNAV();
  },
  { immediate: true },
);

const isLoadingPostUpdateNAV = computed(() => {
  return actionStateStore.isActionState("postUpdateNAVAction", ActionState.Loading);
});
const isLoadingFetchFundNAVUpdatesAction = computed(() => {
  return actionStateStore.isActionState("fetchFundNAVDataAction", ActionState.Loading);
});
const isLoadingFetchSimulateCurrentNAVAction = computed(() => {
  return actionStateStore.isActionState("fetchSimulateCurrentNAVAction", ActionState.Loading);
});
const isLoadingFetchSimulatedNAVMethodValueAction = computed(() => {
  return actionStateStore.isActionState("fetchSimulatedNAVMethodValueAction", ActionState.Loading);
});

onMounted(async () => {
  isLoadingParsedPlannedSettlement.value = true;
  await parsePlannedSettlement(fund.chainId, fund.plannedSettlementPeriod)
    .then((result) => {
      parsedPlannedSettlement.value = result;
    })
    .catch((error) => {
      console.error("Error parsing planned settlement", error);
    })
    .finally(() => {
      isLoadingParsedPlannedSettlement.value = false;
    });
});
</script>

<style scoped lang="scss">
.fund_contract_notification {
  margin: 0;
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
.main_card:not(.main_grid) {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.pending_redemptions_estimate {
  display: flex;
  gap: 0.5rem;
  margin-left: 0.25rem;
  color: $color-primary;
}
.funding_gap {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}
.transfer {
  display: flex;
  flex-direction: column;
  font-size: $text-sm;
  line-height: 1;
  gap: 1rem;
  background: $color-card-background;
  padding: 24px;
  border-radius: $default-border-radius;

  &__input {
    width: 8rem;
  }
  &__content {
    gap: 1.5rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-grow: 1;
    justify-content: space-between;
  }
  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__title {
    font-size: $text-md;
    font-weight: 500;
    color: $color-title;
    margin-bottom: 0.5rem;
  }
  &__subtitle {
    font-size: $text-md;
    color: $color-light-subtitle;
  }
  &__token_data {
    @include borderGray;
    display: flex;
    flex-direction: row;
    color: $color-white;
    margin-bottom: 0.25rem;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.15rem;
  }
}

// remove padding from UiDataBar
.settlement_cycle.data_bar {
  :deep(.data_bar__body) {
    padding: 0 !important;
  }
}
// main header style
.main_header {
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 14px;

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    gap: 20px;
  }
  &__info-icon {
    cursor: pointer;
    display: flex;
    color: $color-text-irrelevant;
  }
}
// tooltip style
.tooltip {
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}
// data bar style
:deep(.data_bar__title) {
  font-weight: 400 !important;
}

// data bar style
:deep(.data_bar__body) {
  display: flex;
  flex-direction: column;
  gap: 20px;

  @include lg {
    flex-direction: row;
  }
}
.title_balance {
  font-size: 21px;
  font-weight: bold;
  line-height: 1;
}
// make even columns
.column-8 {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;


  :deep(.data_bar__item) {
    .data_bar__title,
    .data_bar__subtitle {
      text-align: left !important;
      justify-content: flex-start !important;
      margin-right: auto;;
    }
  }

  @include lg{
    flex-direction: row;
    gap: 5%;
    width: 70%;
  }
}
.column-4 {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;

  @include lg{
    flex-direction: row;
    justify-content: flex-end;
    width: 30%;
  }

  // make buttons full width
  & > * {
    width: 100%;
    & > * {
      width: 100%;
    }
  }
}
</style>
