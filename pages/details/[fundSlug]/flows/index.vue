<template>
  <div class="flows">
    <!-- Settlement rhythm: when it last settled, how often it should, and a
         live countdown to when it next will. -->
    <div class="brand_card flows__settlement">
      <div class="flows__stat">
        <div class="flows__stat_value">
          <v-progress-circular
            v-if="isLoadingFetchFundNAVUpdatesAction"
            class="d-flex"
            size="16"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ fundLastNAVUpdate?.date || "N/A" }}
          </template>
        </div>
        <div class="flows__stat_label">
          Last settlement
        </div>
      </div>

      <div class="flows__vline" />

      <div class="flows__stat">
        <div class="flows__stat_value">
          <v-progress-circular
            v-if="isLoadingParsedPlannedSettlement"
            class="d-flex"
            size="16"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ plannedCycleLabel }}
          </template>
        </div>
        <div class="flows__stat_label">
          Planned settlement cycle
        </div>
      </div>

      <div class="flows__vline" />

      <div class="flows__stat">
        <div class="flows__stat_value flows__stat_value--countdown">
          {{ isOverdue ? "Due now" : countdownText ?? "N/A" }}
        </div>
        <div class="flows__stat_label">
          Next settlement<template v-if="nextSettlementDate">
            ·
            <span class="flows__stat_label_accent">{{ nextSettlementDate }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- The page's working figure: everything below is valued at this NAV. -->
    <div class="brand_card flows__simnav">
      <div class="flows__simnav_main">
        <div class="flows__simnav_value">
          <v-progress-circular
            v-if="isSimulatedNAVLoading"
            class="d-flex"
            size="18"
            width="2"
            indeterminate
          />
          <div v-else-if="fund.pendingRedemptionBalanceError" class="flows__stat_value--error">
            N/A
          </div>
          <template v-else>
            <UiInputNumber
              v-if="isSimulatedNAVEdit"
              v-model="customSimulatedNAVValue"
              :rules="customSimulatedNAVValueRules"
              class="flows__simnav_input"
              hide-details
              @input="customSimulatedNAVValueChanged = true"
            />
            <template v-else>
              {{ totalCurrentSimulatedNAVFormatted }}
            </template>
            <div
              v-if="isAnySimulatedNavError"
              class="flows__simnav_warning"
            >
              <Icon
                icon="octicon:question-16"
                width="1rem"
                color="var(--color-warning)"
              />
              <v-tooltip activator="parent" location="top">
                Something went wrong while simulating NAV value. Retry
                simulating NAV.
              </v-tooltip>
            </div>
          </template>
        </div>
        <div class="flows__simnav_label">
          Simulated NAV
          <button
            type="button"
            class="flows__simnav_toggle"
            @click="toggleSimulatedNAVEdit()"
          >
            {{ isSimulatedNAVEdit ? "Reset" : "Edit" }}
          </button>
          <UiInfoTooltip
            text="Off-chain simulation of the vault NAV at current prices, used to value pending flows ahead of the on-chain update."
          />
        </div>
      </div>

      <button
        type="button"
        class="flows__ghost_button"
        :disabled="isSimulatedNAVLoading"
        @click="refreshFlowsInfo()"
      >
        Re-simulate
      </button>
    </div>

    <!-- Everything admin-contract: what it holds, what it owes, moving base
         asset either way, and the settle action itself. -->
    <div class="brand_card flows__admin">
      <div class="flows__admin_title">
        Admin contract
      </div>
      <div class="flows__admin_stats">
        <div class="flows__stat">
          <div class="flows__stat_value">
            <v-progress-circular
              v-if="fund.fundContractBaseTokenBalanceLoading"
              class="d-flex"
              size="16"
              width="2"
              indeterminate
            />
            <div
              v-else-if="fund.fundContractBaseTokenBalanceError"
              class="flows__stat_value--error"
            >
              N/A
            </div>
            <template v-else>
              {{ adminContractBalanceFormatted }}
            </template>
          </div>
          <div class="flows__stat_label">
            Admin contract balance
          </div>
        </div>

        <div class="flows__stat">
          <div class="flows__stat_value">
            <v-progress-circular
              v-if="
                fund.pendingRedemptionBalanceLoading &&
                  fund.pendingRedemptionBalance == null
              "
              class="d-flex"
              size="16"
              width="2"
              indeterminate
            />
            <div
              v-else-if="fund.pendingRedemptionBalanceError"
              class="flows__stat_value--error"
            >
              N/A
            </div>
            <template v-else>
              {{ pendingRedemptionBalanceFormatted }}
            </template>
          </div>
          <div class="flows__stat_label">
            Redemption requests
            <template v-if="estimatedPendingRedemptionBalanceInBaseFormatted">
              ·
              <span class="flows__stat_label_accent">
                ≈ {{ estimatedPendingRedemptionBalanceInBaseFormatted }}
              </span>
            </template>
          </div>
        </div>

        <div class="flows__stat">
          <div class="flows__stat_value">
            <v-progress-circular
              v-if="
                fund.pendingDepositBalanceLoading &&
                  fund.pendingDepositBalance == null
              "
              class="d-flex"
              size="16"
              width="2"
              indeterminate
            />
            <div
              v-else-if="fund.pendingDepositBalanceError"
              class="flows__stat_value--error"
            >
              N/A
            </div>
            <template v-else>
              {{ pendingDepositBalanceFormatted }}
            </template>
          </div>
          <div class="flows__stat_label">
            Deposit requests
          </div>
        </div>

        <div class="flows__stat">
          <div class="flows__stat_value">
            <v-progress-circular
              v-if="isSimulatedNAVLoading"
              class="d-flex"
              size="16"
              width="2"
              indeterminate
            />
            <div
              v-else-if="fund.pendingRedemptionBalanceError"
              class="flows__stat_value--error"
            >
              N/A
            </div>
            <button
              v-else
              type="button"
              class="flows__funding_gap"
              :class="fundingGapClass"
              @click="setTransferToFundValue(absoluteFundingGap)"
            >
              {{ fundingGapFormatted }}
              <v-tooltip activator="parent" location="top">
                Prefill the transfer below with this amount.
              </v-tooltip>
            </button>
          </div>
          <div class="flows__stat_label">
            Funding gap
          </div>
        </div>
      </div>

      <div class="flows__admin_actions">
        <FundSettlementTransferBaseAsset v-model="transferToFundValue" />
        <FundSettlementSweepFundContract
          :funding-gap="fundingGap"
          :pending-redemptions-in-base="estimatedPendingRedemptionBalanceInBase"
        />
      </div>

      <div class="flows__admin_settle">
        <UiInfoTooltip
          location="start"
          :size="14"
          text="Admin contract balance must cover redemption requests before flows can settle."
        />
        <span class="flows__settle_action">
          <v-tooltip
            activator="parent"
            location="top"
            :disabled="!curatorDisabledReason"
          >
            {{ curatorDisabledReason }}
          </v-tooltip>
          <v-btn
            :disabled="!canExecuteAsCurator || isLoadingPostUpdateNAV"
            class="bg-primary text-secondary"
            @click="settleFlows()"
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
            Update NAV & settle flows
          </v-btn>
        </span>
      </div>
    </div>

    <FundFlowsRequestQueue
      :fund="fund"
      :exchange-rate="estimatedFundToBaseTokenExchangeRate"
    />
  </div>
</template>

<script setup lang="ts">
import { ethers, FixedNumber } from "ethers";
import {
  commify,
  formatTokenValue,
  roundToSignificantDecimals,
} from "~/composables/formatters";
import {
  parsePlannedSettlement,
  parsePlannedSettlementSeconds,
} from "~/composables/fund/parsePlannedSettlement";
import { useSettlementCountdown } from "~/composables/fund/useSettlementCountdown";
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import { useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { ActionState } from "~/types/enums/action_state";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const actionStateStore = useActionStateStore();

const fund = useAttrs().fund as IFund;
const {
  totalCurrentSimulatedNAV,
  fundLastNAVUpdate,
  fundLastNAVUpdateMethods,
} = storeToRefs(fundStore);

// Settlement runs from the curator's own wallet through the vault's Roles
// modifier; a wallet connected as the Safe keeps sending calls unwrapped.
const {
  canExecute: canExecuteAsCurator,
  disabledReason: curatorDisabledReason,
} = useCuratorExecution();

const customSimulatedNAVValue = ref("");
const customSimulatedNAVValueChanged = ref(false);
const parsedPlannedSettlement = ref("");
const plannedCycleSeconds = ref<number | undefined>(undefined);
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

// ---- Settlement rhythm ------------------------------------------------------

const plannedCycleLabel = computed(() => {
  const parsed = parsedPlannedSettlement.value;
  if (!parsed || parsed === "N/A") return "N/A";
  return `Every ${parsed}`;
});

const lastSettlementMs = computed(
  () => fundLastNAVUpdate.value?.timestamp || undefined,
);
const { nextSettlementMs, countdownText, isOverdue } = useSettlementCountdown(
  lastSettlementMs,
  plannedCycleSeconds,
);

// "Aug 27, 09:00 UTC" — hourCycle rather than hour12 so midnight reads 00, not 24.
const nextSettlementDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const nextSettlementDate = computed(() => {
  if (nextSettlementMs.value === undefined) return "";
  return `${nextSettlementDateFormat.format(new Date(nextSettlementMs.value))} UTC`;
});

// ---- Simulated NAV ----------------------------------------------------------

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

const totalCurrentSimulatedNAVFormatted = computed(() => {
  if (!totalCurrentSimulatedNAV.value) return "0";
  return fundStore.getFormattedBaseTokenValue(totalCurrentSimulatedNAV.value);
});

// ---- Admin contract stats ---------------------------------------------------

const adminContractBalanceFormatted = computed(() => {
  return `${formatTokenValue(
    fund.fundContractBaseTokenBalance,
    fund.baseToken.decimals,
  )} ${fund.baseToken.symbol}`;
});
const pendingDepositBalanceFormatted = computed(() => {
  if (!fund?.pendingDepositBalance) return `0 ${fund.baseToken.symbol}`;
  return `${formatTokenValue(
    fund.pendingDepositBalance,
    fund.baseToken.decimals,
  )} ${fund.baseToken.symbol}`;
});
const pendingRedemptionBalanceFormatted = computed(() => {
  if (!fund?.pendingRedemptionBalance) return `0 ${fund.fundToken.symbol}`;
  return `${formatTokenValue(
    fund.pendingRedemptionBalance,
    fund.fundToken.decimals,
  )} ${fund.fundToken.symbol}`;
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
    let totalCurrentSimulatedNAVValue;
    try {
      totalCurrentSimulatedNAVValue = FixedNumber.fromString(navValueString || "0");
    } catch {
      return undefined;
    }

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

  // Calculate the estimated value using the exchange rate
  return pendingRedemptionBalance.mul(
    estimatedFundToBaseTokenExchangeRate.value,
  );
});
const estimatedPendingRedemptionBalanceInBaseFormatted = computed(() => {
  if (!fundStore.fund || !estimatedPendingRedemptionBalanceInBase.value) {
    return "";
  }
  const rounded = roundToSignificantDecimals(
    estimatedPendingRedemptionBalanceInBase.value.toString(),
  );
  return `${commify(rounded)} ${fundStore.fund.baseToken.symbol}`;
});

const fundingGap = computed(() => {
  if (
    !fundStore.fund ||
    estimatedPendingRedemptionBalanceInBase.value === undefined
  )
    return undefined;

  // Difference between admin contract liquidity and the amount of redemption requests.
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
  const rounded = roundToSignificantDecimals(fundingGap.value.toString());
  const symbol = fundStore.fund?.baseToken.symbol;
  const sign = rounded.startsWith("-") ? "−" : "+";
  return `${sign}${commify(rounded.replace("-", ""))} ${symbol}`;
});
const absoluteFundingGap = computed(() => {
  if (!fundStore.fund || fundingGap.value === undefined) return "";
  return fundingGap.value.toString().replace("-", "");
});

const fundingGapClass = computed(() => {
  if (!fundStore.fund || fundingGap.value === undefined) return "";
  if (fundingGap.value.gt(FixedNumber.fromValue(0))) {
    return "flows__funding_gap--positive";
  } else if (fundingGap.value.lt(FixedNumber.fromValue(0))) {
    return "flows__funding_gap--negative";
  }
  return "flows__funding_gap--flat";
});

// ---- Actions ----------------------------------------------------------------

const setTransferToFundValue = (value: any) => {
  transferToFundValue.value = value;
};
const toggleSimulatedNAVEdit = () => {
  isSimulatedNAVEdit.value = !isSimulatedNAVEdit.value;
  if (!isSimulatedNAVEdit.value) {
    // Reset means back to the fetched simulation — also let the next
    // simulation repopulate the field again.
    customSimulatedNAVValueChanged.value = false;
    customSimulatedNAVValue.value = formatTokenValue(
      totalCurrentSimulatedNAV.value,
      fund.baseToken.decimals,
      false,
    );
  }
};

const refreshFlowsInfo = () => {
  // Refresh current simulated NAV.
  fundStore.simulateCurrentNAV();

  // Refresh Deposit & Redemption Requests.
  fundStore.fetchFundPendingDepositRedemptionBalance();

  // Refresh the admin contract base token balance.
  fundStore.fetchFundContractBaseTokenBalance();
};

const settleFlows = async () => {
  try {
    await fundStore.postUpdateNAV();
  } catch {
    // The action already reported the failure; nothing to refresh.
    return;
  }
  // A settle moves the anchor: refreshed NAV data resets the countdown a full
  // cycle ahead, and the flow balances follow.
  fundStore.fetchFundNAVData();
  refreshFlowsInfo();
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
const isSimulatedNAVLoading = computed(() => {
  return (
    isLoadingFetchFundNAVUpdatesAction.value ||
    actionStateStore.isActionState("fetchSimulateCurrentNAVAction", ActionState.Loading) ||
    actionStateStore.isActionState("fetchSimulatedNAVMethodValueAction", ActionState.Loading)
  );
});

onMounted(async () => {
  isLoadingParsedPlannedSettlement.value = true;
  try {
    const [prose, seconds] = await Promise.all([
      parsePlannedSettlement(fund.chainId, fund.plannedSettlementPeriod),
      parsePlannedSettlementSeconds(fund.chainId, fund.plannedSettlementPeriod),
    ]);
    parsedPlannedSettlement.value = prose;
    plannedCycleSeconds.value = seconds;
  } catch (error) {
    console.error("Error parsing planned settlement", error);
  } finally {
    isLoadingParsedPlannedSettlement.value = false;
  }
});
</script>

<style scoped lang="scss">
.flows {
  display: flex;
  flex-direction: column;
  gap: 1.375rem;
}

/* ---- Shared stat treatment: mono figure over a mono uppercase caption. ---- */

.flows__stat {
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  min-width: 0;
}

.flows__stat_value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: $font-mono;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.1;
  color: $color-white;
  font-variant-numeric: tabular-nums;

  &--countdown {
    color: $color-cyan;
  }

  &--error {
    color: $color-error;
  }
}

.flows__stat_label {
  font-family: $font-mono;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;
}

/* The date inside a label keeps its own case — "Aug 27, 09:00 UTC", not
   shouted along with the caption. */
.flows__stat_label_accent {
  color: $color-cyan;
  text-transform: none;
}

/* ---- Settlement header: stats clustered left, split by hairlines. ---- */

.flows__settlement {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  .flows__vline {
    align-self: stretch;
    height: 1px;
    background: $color-line;
  }

  @include md {
    flex-direction: row;
    align-items: center;
    gap: 36px;

    .flows__vline {
      width: 1px;
      height: auto;
    }
  }
}

/* ---- Simulated NAV card. ---- */

.flows__simnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.flows__simnav_main {
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  min-width: 0;
}

.flows__simnav_value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.625rem;
  font-family: $font-mono;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.3;
  color: $color-white;
  font-variant-numeric: tabular-nums;
}

.flows__simnav_label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: $font-mono;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;
}

.flows__simnav_toggle {
  font-family: $font-mono;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $color-cyan;
  transition: color $default-transition-time ease;

  &:hover {
    color: $color-cyan-soft;
  }
}

/* The edit state swaps the figure for a quiet mono field, same slot. */
.flows__simnav_input {
  width: 175px;
  flex: none;

  :deep(.v-field) {
    background: $color-card-background;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    box-shadow: none;
  }

  :deep(.v-field__input) {
    min-height: 0;
    padding: 8px 10px;
  }

  :deep(input) {
    font-family: $font-mono;
    font-size: 15px;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }
}

.flows__simnav_warning {
  display: flex;
  align-items: center;
}

/* ---- Ghost hairline button (Re-simulate). ---- */

.flows__ghost_button {
  flex: none;
  padding: 0.5625rem 0.875rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  font-size: 13px;
  font-weight: 600;
  color: $color-text-irrelevant;
  white-space: nowrap;
  transition: color $default-transition-time ease,
    border-color $default-transition-time ease;

  &:hover:not(:disabled) {
    color: $color-white;
    border-color: $color-line-3;
  }

  &:disabled {
    color: $color-inactive;
    cursor: default;
  }
}

/* ---- Admin contract card. ---- */

.flows__admin {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.flows__admin_title {
  font-family: $font-mono;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: $color-steel-blue;
}

.flows__admin_stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;

  @include sm {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @include lg {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 28px;
  }
}

.flows__funding_gap {
  font: inherit;
  color: inherit;
  text-align: left;

  &:hover {
    text-decoration: underline;
    cursor: pointer;
  }

  &--positive {
    color: $color-pos;
  }

  &--negative {
    color: $color-neg;
  }

  &--flat {
    color: $color-steel-blue;
  }
}

.flows__admin_actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.75rem;
  padding-top: 22px;
  border-top: 1px solid $color-line;

  @include md {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 32px;
  }
}

.flows__admin_settle {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding-top: 20px;
  border-top: 1px solid $color-line;
}

.flows__settle_action {
  flex: none;
}

@media (prefers-reduced-motion: reduce) {
  .flows__simnav_toggle,
  .flows__ghost_button {
    transition: none;
  }
}
</style>
