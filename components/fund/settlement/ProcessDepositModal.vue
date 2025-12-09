<template>
  <UiConfirmDialog
    :model-value="modelValue"
    :title="modalTitle"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="deposit-flow mb-4">
      <div v-for="(step, index) in stepsDeposit" :key="index">
        <v-tooltip
          :disabled="!step.isDisabled"
          activator="parent"
          location="top"
        >
          <template #default>
            {{ step.tooltip }}
          </template>
          <template #activator="{ props }">
            <div v-bind="props">
              <div
                :key="index"
                class="step"
                :class="{ 'is_disabled': step.isDisabled }"
              >
                <span class="label">
                  {{ step.label }}
                </span>
                <Icon
                  v-if="step.done && !step.isDisabled"
                  icon="material-symbols:done"
                  class="text-success me-2"
                  height="1.2rem"
                  width="1.2rem"
                />
                <v-progress-circular
                  v-if="step.loading"
                  class="d-flex ms-2"
                  size="20"
                  width="3"
                  indeterminate
                />
              </div>
            </div>
          </template>
        </v-tooltip>
      </div>
    </div>

    <div class="buttons_group">
      <template v-if="!hasDelegatedToSelf && hasApprovedAmount">
        <v-btn
          class="button"
          variant="outlined"
          @click="delegateToMyself"
        >
          <template #prepend>
            <v-progress-circular
              v-if="isLoadingDelegate"
              class="d-flex"
              size="20"
              width="3"
              indeterminate
            />
          </template>
          Delegate to Myself
        </v-btn>

        <FundGovernanceModalDelegateVotes
          v-model="isDelegateModalOpen"
        />

      </template>
      <template v-else-if="canUserProcessDeposit || shouldUserWaitSettlementOrCancelDeposit">
        <h3 v-if="shouldUserWaitSettlementOrCancelDeposit">
          Wait for settlement or cancel the deposit request.
        </h3>
        <h3 v-else-if="canUserProcessDeposit">
          You can now process or cancel the deposit request.
        </h3>

        <v-btn
          class="button"
          variant="outlined"
          :disabled="shouldUserWaitSettlementOrCancelDeposit"
          @click="processDeposit"
        >
          <template #prepend>
            <v-progress-circular
              v-if="isLoadingProcessDeposit"
              class="d-flex"
              size="20"
              width="3"
              indeterminate
            />
          </template>
          Process Deposit
        </v-btn>

        <FundCurrentCyclePendingRequest
          v-if="userDepositRequestExists && fund"
          :fund-transaction-request="userDepositRequest"
          :exchange-rate="fundStore.baseToFundTokenExchangeRateLastNavUpdate"
          :token0="fund.baseToken"
          :token1="fund.fundToken"
          style="width: 100%;"
          @cancel-request-success="$emit('update:modelValue', false)"
        />

      </template>
      <template v-for="button in buttons">
        <v-tooltip
          v-if="button.isVisible"
          :key="button.name"
          :disabled="!button.tooltipText"
          bottom
        >
          <template #default>
            {{ button.tooltipText }}
          </template>
          <template #activator="{ props }">
            <span v-bind="props">
              <v-btn
                class="button"
                :disabled="button.disabled"
                variant="outlined"
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
            </span>
          </template>
        </v-tooltip>
      </template>
    </div>
    <div
      v-if="visibleErrorMessages && tokenValueChanged"
      class="text-red mt-4 text-center"
    >
      <div v-for="(error, index) in visibleErrorMessages" :key="index">
        {{ error?.message }}
      </div>
    </div>
  </UiConfirmDialog>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { storeToRefs } from "pinia";
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import { formatTokenValue } from "~/composables/formatters";
import type IFormError from "~/types/form_error";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  tokenValue: {
    type: String,
    default: "",
  },
  tokenValueChanged: {
    type: Boolean,
    default: false,
  },
  visibleErrorMessages: {
    type: Array as () => IFormError[],
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue", "deposit-success", "update:tokenValue"]);

const toastStore = useToastStore();
const fundStore = useFundStore();
const fund = computed(() => fundStore.fund);
const {
  shouldUserRequestDeposit,
  shouldUserApproveAllowance,
  canUserProcessDeposit,
  shouldUserWaitSettlementOrCancelDeposit,
  userDepositRequest,
  userDepositRequestExists,
} = storeToRefs(fundStore);

const loadingRequestDeposit = ref(false);
const loadingApproveAllowance = ref(false);
const isLoadingDelegate = ref(false);
const isLoadingProcessDeposit = ref(false);
const isDelegateModalOpen = ref(false);

const hasApprovedAmount = computed(() => {
  if (!fundStore.fundUserData?.fundAllowance) return false;
  if (!fundStore.fundUserData?.depositRequest?.amount) return false;

  return fundStore.fundUserData?.fundAllowance >= fundStore.fundUserData?.depositRequest?.amount;
});

const hasDelegatedToSelf = computed(() => {
  if (!fundStore.fundUserData.fundDelegateAddress) return false;
  if (!fundStore.activeAccountAddress) return false;

  return fundStore.fundUserData.fundDelegateAddress.toLowerCase() === fundStore.activeAccountAddress.toLowerCase();
});

const depositRequestAmountFormatted = computed(() => {
  const baseToken = fundStore.fund?.baseToken;
  if (!userDepositRequest?.value?.amount || !baseToken) return "N/A";

  // Use formatTokenValue directly since we've imported it
  return formatTokenValue(
    userDepositRequest?.value?.amount,
    baseToken.decimals,
    false,
  );
});

const modalTitle = computed(() => {
  const baseToken = fundStore.fund?.baseToken;

  // If we have a deposit request, show its amount and token symbol
  if (userDepositRequestExists.value && userDepositRequest?.value?.amount && baseToken) {
    return `Deposit Flow: ${depositRequestAmountFormatted.value} ${baseToken.symbol}`;
  }

  // If we're in the request deposit phase and have a token value, show that
  if (shouldUserRequestDeposit.value && props.tokenValue && baseToken) {
    return `Deposit Flow: ${props.tokenValue} ${baseToken.symbol}`;
  }

  // Default title
  return "Deposit Flow";
});

const handleError = (error: any, refreshData: boolean = true) => {
  loadingRequestDeposit.value = false;
  loadingApproveAllowance.value = false;
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.");
  } else {
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
    console.error(error);
    if (refreshData) {
      fundStore.fetchUserFundData(
        fundStore.selectedFundChain,
        fundStore.selectedFundAddress,
      );
    }
  }
};

const setTokenValueToDepositRequestAmount = () => {
  // This is now handled differently since tokenValue is a prop
  emit("update:tokenValue", depositRequestAmountFormatted.value);
};

const requestDeposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to request deposit.");
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.");
    return;
  }
  console.log("REQUEST DEPOSIT");
  loadingRequestDeposit.value = true;

  const tokensWei = ethers.parseUnits(
    props.tokenValue || "0",
    fund.value?.baseToken.decimals,
  );

  console.log(
    "Request deposit tokensWei: ",
    tokensWei,
    "from : ",
    fundStore.activeAccountAddress,
  );

  const encodedFunctionCall = encodeFundFlowsCallFunctionData(
    "requestDeposit",
    [tokensWei],
  );

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: ", hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);

        if (receipt.status) {
          toastStore.successToast("Your deposit request was successful.");
          fundStore.fundUserData.depositRequest = {
            amount: tokensWei,
            timestamp: Date.now(),
            type: FundTransactionType.Deposit,
          };

          // deposit-success event is emitted to open the delegate dialog.
          emit("deposit-success");
        } else {
          toastStore.errorToast(
            "Your deposit request has failed. Please contact the Rethink Finance support.",
          );
          fundStore.fetchUserFundData(
            fundStore.selectedFundChain,
            fundStore.selectedFundAddress,
          );
        }
        loadingRequestDeposit.value = false;
      })
      .on("error", (error: any) => {
        handleError(error, false);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const approveAllowance = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to approve allowance.");
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.");
    return;
  }
  console.log("APPROVE ALLOWANCE");
  loadingApproveAllowance.value = true;

  setTokenValueToDepositRequestAmount();

  // Use userDepositRequest?.value?.amount if tokenValue is not specified
  let tokensWei;
  if (userDepositRequest?.value?.amount) {
    tokensWei = userDepositRequest.value.amount;
  } else {
    tokensWei = ethers.parseUnits(
      props.tokenValue || "0",
      fund.value?.baseToken.decimals,
    );
  }

  console.log(
    "Approve allowance tokensWei: ",
    tokensWei,
    "from : ",
    fundStore.activeAccountAddress,
  );
  const allowanceValue = tokensWei;

  try {
    // call the approval method
    await fundStore.fundBaseTokenContract
      .send("approve", {}, fund.value?.address, tokensWei)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt :", receipt);

        if (receipt.status) {
          toastStore.successToast(
            "The approval was successful. You can make the deposit now.",
          );

          // Refresh allowance value.
          fundStore.fundUserData.fundAllowance = allowanceValue;
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }
        loadingApproveAllowance.value = false;
      })
      .on("error", (error: any) => {
        handleError(error, false);
      });
  } catch (error: any) {
    handleError(error);
  }
};

const isRequestDepositDisabled = computed(() => {
  return (
    props.visibleErrorMessages.length > 0 ||
    loadingRequestDeposit.value || loadingApproveAllowance.value ||
    !fundStore.isUserWalletWhitelisted
  );
});

const buttons = ref([
  {
    name: "Request Deposit",
    onClick: requestDeposit,
    isVisible: shouldUserRequestDeposit,
    disabled: isRequestDepositDisabled,
    loading: loadingRequestDeposit,
    tooltipText: computed(() => {
      if (userDepositRequestExists.value) {
        return "Deposit request already exists. To change it, you first have to cancel the existing one.";
      }
      if (!fundStore.isUserWalletWhitelisted) {
        return "Your wallet address is not whitelisted to allow deposits into this vault.";
      }
      return "";
    }),
  },
  {
    name: "Approve Amount",
    onClick: approveAllowance,
    loading: loadingApproveAllowance,
    isVisible: shouldUserApproveAllowance,
    tooltipText: undefined,
  },
]);

const stepsDeposit = computed(() => [
  {
    label: "1. Request Deposit",
    done: userDepositRequestExists.value,
    loading: loadingRequestDeposit.value,
    isDisabled: false,
  },
  {
    label: "2. Approve Amount",
    done: hasApprovedAmount.value,
    loading: loadingApproveAllowance.value,
    isDisabled: false,
  },
  {
    label: "3. Delegate to Myself",
    done: hasDelegatedToSelf.value && hasApprovedAmount.value,
    loading: isLoadingDelegate.value,
  },
  {
    label: "4. Process Deposit",
    done: false, // hasProcessedDeposit.value
    isDisabled: shouldUserWaitSettlementOrCancelDeposit.value && hasDelegatedToSelf.value,
    tooltip: "Wait for the next NAV update to process the deposit.",
  },
]);

const processDeposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the vault.");
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("Vault data is missing.");
    return;
  }
  if (!userDepositRequest?.value?.amount) {
    toastStore.errorToast("Deposit request data is missing.");
    return;
  }
  console.log(
    "DEPOSIT tokensWei: ",
    userDepositRequest?.value?.amount,
    "from : ",
    fundStore.activeAccountAddress,
  );
  isLoadingProcessDeposit.value = true;
  const encodedFunctionCall = encodeFundFlowsCallFunctionData("deposit");

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        // Refresh user balances & allowance & refresh pending requests.
        fundStore.fetchUserFundData(
          fundStore.selectedFundChain,
          fundStore.selectedFundAddress,
        );

        if (receipt.status) {
          toastStore.successToast("Your deposit was successful.");
          emit("update:modelValue", false);

          // emit event to open the delegate votes modal
          emit("deposit-success");
        } else {
          toastStore.errorToast(
            "The transaction has failed. Please contact the Rethink Finance support.",
          );
        }

        isLoadingProcessDeposit.value = false;
      })
      .on("error", (error: any) => {
        isLoadingProcessDeposit.value = false;
        console.error(error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    isLoadingProcessDeposit.value = false;
    handleError(error);
  }
};

const delegateToMyself = async () => {
  try {
    isLoadingDelegate.value = true;

    const delegateTo = fundStore.activeAccountAddress;
    const governanceTokenAddress = fundStore.fund?.governanceToken.address;
    const fundAddress = fundStore.fund?.address;

    if (fundAddress === ethers.ZeroAddress) {
      toastStore.errorToast(
        "The vault address is not available. Please contact the Rethink Finance support.",
      );
      return;
    }

    let contract = fundStore.fundContract;

    if (
      governanceTokenAddress !== fundAddress &&
      governanceTokenAddress !== ethers.ZeroAddress
    ) {
      // external gov token
      contract = fundStore.fundGovernanceTokenContract;
    }

    await contract
      .send("delegate", {}, delegateTo)
      .on("transactionHash", function (hash: any) {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", function (receipt: any) {
        console.log(receipt);
        if (receipt.status) {
          toastStore.successToast(
            "Delegation of Governance Tokens Succeeded",
          );

          if (delegateTo) fundStore.fundUserData.fundDelegateAddress = delegateTo;
        } else {
          toastStore.errorToast(
            "The delegateTo tx has failed. Please contact the Rethink Finance support.",
          );
        }
        isLoadingDelegate.value = false;
      })
      .on("error", function (error: any) {
        console.error(error);
        isLoadingDelegate.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      })
  } catch (error) {
    console.error("Error delegating to external gov token: ", error);
    isLoadingDelegate.value = false;
    toastStore.errorToast(
      "There has been an error. Please contact the Rethink Finance support.",
    );
  }
};
</script>

<style lang="scss" scoped>
.buttons_group {
  gap: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;

  .button {
    color: $color-primary !important;
    border-color: $color-primary !important;

    &:hover {
      background: $color-primary !important;
      color: $color-white !important;
      border-color: $color-primary !important;
    }
  }
}

.step {
  display: flex;
  align-items: center;
  margin: 0.25rem 0;
  width: fit-content;

  &.is_disabled {
    opacity: 0.5;
  }
}
</style>
