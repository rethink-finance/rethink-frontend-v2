<template>
  <div style="width: 100%">
    <template v-if="!hasRequestedDeposit">
      <FundSettlementBaseForm
        v-if="fund"
        v-model="tokenValue"
        :token0="fund.baseToken"
        :token1="fund.fundToken"
        :token0-user-balance="fundStore.fundUserData.baseTokenBalance"
        :token1-user-balance="fundStore.fundUserData.fundTokenBalance"
        :exchange-rate="fundStore.baseToFundTokenExchangeRate"
      />
    </template>
    <div v-else class="deposit-flow" @click="handleDepositClick">
      <h3 class="title">
        Deposit in progress:
      </h3>

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
                :class="{ 'is-disabled': step.isDisabled }"
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

    <div class="divider" />


    <div v-if="accountStore.isConnected" style="width: 100%">
      <div
        class="buttons_group"
      >
        <v-tooltip
          :disabled="fundStore.isUserWalletWhitelisted"
          location="bottom"
        >
          <template #default>
            Your wallet address is not whitelisted to allow deposits into this OIV.
          </template>
          <template #activator="{ props }">
            <span v-bind="props">
              <v-btn
                class="button-deposit button"
                variant="outlined"
                :disabled="isDepositButtonDisabled"
                @click="handleDepositClick"
              >
                {{ hasRequestedDeposit ? 'Continue Deposit' : 'Deposit' }}
              </v-btn>
            </span>
          </template>
        </v-tooltip>
      </div>

      <div
        v-if="visibleErrorMessages && tokenValueChanged"
        class="text-red mt-4 text-center"
      >
        <div v-for="(error, index) in visibleErrorMessages" :key="index">
          {{ error.message }}
        </div>
      </div>


      <UiConfirmDialog
        v-model="isDepositModalOpen"
        title="Deposit Flow"
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
                    :class="{ 'is-disabled': step.isDisabled }"
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
              :exchange-rate="fundStore.baseToFundTokenExchangeRate"
              :token0="fund.baseToken"
              :token1="fund.fundToken"
              style="width: 100%;"
              @cancel-request-success="isDepositModalOpen = false"
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
            {{ error.message }}
          </div>
        </div>
      </UiConfirmDialog>

    </div>
    <template v-else>
      <v-btn
        class="bg-primary text-secondary"
        @click="accountStore.connectWallet()"
      >
        Connect Wallet
      </v-btn>
    </template>
  </div>
</template>

<script setup lang="ts">
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import { ethers } from "ethers";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFormError from "~/types/form_error";

const emit = defineEmits(["deposit-success"]);
const toastStore = useToastStore();
const accountStore = useAccountStore();
const fundStore = useFundStore();

const tokenValue = ref("");
const tokenValueChanged = ref(false);
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

const isDepositModalOpen = ref(false);
const isDelegateModalOpen = ref(false);

watch(
  () => tokenValue.value,
  () => {
    tokenValueChanged.value = true;
  },
);

const rules = [
  (value: string): boolean | IFormError => {
    if (!fund.value) return { message: "Fund data is missing.", display: true };
    let valueWei;
    try {
      valueWei = ethers.parseUnits(value, fund.value?.baseToken.decimals);
    } catch {
      return {
        message: `Make sure the value has max ${fund.value?.baseToken.decimals} decimals.`,
        display: false,
      };
    }
    if (valueWei <= 0)
      return { message: "Value must be positive.", display: false };

    console.log(
      "[DEPOSIT] check user base token balance wei: ",
      valueWei,
      fundStore.fundUserData.baseTokenBalance,
    );
    // This condition is only valid for Request Deposit, we don't check this condition for Approve.
    if (
      !userDepositRequestExists.value &&
      fundStore.fundUserData.baseTokenBalance < valueWei
    ) {
      const userBaseTokenBalanceFormatted = formatTokenValue(
        fundStore.fundUserData.baseTokenBalance,
        fund.value.baseToken.decimals,
      );
      return {
        message: `Your ${fund.value.baseToken.symbol} balance is too low: ${userBaseTokenBalanceFormatted}.`,
        display: true,
      };
    }
    return true;
  },
];

const depositRequestAmountFormatted = computed(() => {
  const baseToken = fundStore.fund?.baseToken;
  if (!userDepositRequest?.value?.amount || !baseToken) return "N/A";
  return formatTokenValue(
    userDepositRequest?.value?.amount,
    baseToken.decimals,
    false,
  );
});

const isAnythingLoading = computed(() => {
  // Object.values returns an array of values from the actions object
  // some() checks if at least one element passes the test implemented by the provided function
  return loadingRequestDeposit.value || loadingApproveAllowance.value;
});

const isRequestDepositDisabled = computed(() => {
  return (
    errorMessages.value.length > 0 ||
    isAnythingLoading.value ||
    !fundStore.isUserWalletWhitelisted
  );
});

const errorMessages = computed<IFormError[]>(() => {
  // Disable deposit button if any of rules is false.
  return rules
    .map((rule) => rule(tokenValue.value || "0"))
    .filter((rule) => rule !== true) as IFormError[];
});
const visibleErrorMessages = computed<IFormError[]>(() => {
  return errorMessages.value.filter((error: IFormError) => error.display);
});
const tokensWei = computed(() => {
  if (!fund.value?.baseToken) return 0n;
  return ethers.parseUnits(
    tokenValue.value || "0",
    fund.value?.baseToken.decimals,
  );
});

const handleError = (error: any, refreshData: boolean = true) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
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

/**
 * Sending a transaction and listening to the events.
 * https://docs.web3js.org/guides/wallet/transactions#sending-a-transaction-and-listening-to-the-events
 */
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

  console.log(
    "Request deposit tokensWei: ",
    tokensWei.value,
    "from : ",
    fundStore.activeAccountAddress,
  );

  const encodedFunctionCall = encodeFundFlowsCallFunctionData(
    "requestDeposit",
    [tokensWei.value],
  );
  console.log(
    "isConnectedWalletUsingLedger:",
    accountStore.isConnectedWalletUsingLedger,
  );
  console.log("contract:", fundStore.fundContract);
  console.warn("connectedWallet", accountStore?.connectedWallet);

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
          // Set form token value to user's current balance + current deposit request value so that
          // he can approve it without inputting the value himself, for better UX.
          // TODO takes 15-20 sec for node to sync .. fix
          // await fundStore.fetchUserBalances();
          fundStore.fundUserData.depositRequest = {
            amount: tokensWei.value,
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

const processDeposit = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to deposit tokens to the OIV.")
    return;
  }
  if (!fundStore.fund) {
    toastStore.errorToast("OIV data is missing.")
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
          isDepositModalOpen.value = false;

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

const setTokenValueToDepositRequestAmount = () => {
  tokenValue.value = depositRequestAmountFormatted.value;
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

  console.log(
    "Approve allowance tokensWei: ",
    tokensWei.value,
    "from : ",
    fundStore.activeAccountAddress,
  );
  const allowanceValue = tokensWei.value;

  try {
    // call the approval method
    await fundStore.fundBaseTokenContract
      .send("approve", {}, fund.value?.address, tokensWei.value)
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


const hasRequestedDeposit = computed(() => {
  console.log("fundStore.fundUserDataStore.fundUserDataStore.fundUserData: ", fundStore.fundUserData);
  return !!fundStore.fundUserData.depositRequest?.timestamp
});

const hasApprovedAmount = computed(() => {
  if (!fundStore.fundUserData?.fundAllowance) return false;
  if (!fundStore.fundUserData?.depositRequest?.amount) return false;

  return fundStore.fundUserData?.fundAllowance >= fundStore.fundUserData?.depositRequest?.amount && hasRequestedDeposit.value;
});

const hasDelegatedToSelf = computed(() => {
  if (!fundStore.fundUserData.fundDelegateAddress) return false;
  if (!fundStore.activeAccountAddress) return false;

  return fundStore.fundUserData.fundDelegateAddress.toLowerCase() === fundStore.activeAccountAddress.toLowerCase();
});

const hasProcessedDeposit = computed(() => {
  return false;
  // return fundStore.fundUserData.depositRequestProcessed;
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
        return "Your wallet address is not whitelisted to allow deposits into this OIV.";
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
    done: hasRequestedDeposit.value,
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
    done: hasProcessedDeposit.value,
    isDisabled: shouldUserWaitSettlementOrCancelDeposit.value && hasDelegatedToSelf.value,
    tooltip: "Wait for the next NAV update to process the deposit.",
  },
]);

const handleDepositClick = () =>{
  if(!hasRequestedDeposit.value){
    requestDeposit();
  }
  isDepositModalOpen.value = true;
}


const isDepositButtonDisabled = computed(() => {
  return (
    (!hasRequestedDeposit.value && errorMessages.value.length > 0) ||
    !fundStore.isUserWalletWhitelisted
  );
});

const delegateToMyself = async () => {
  try {
    isLoadingDelegate.value = true;

    const delegateTo = fundStore.activeAccountAddress
    const governanceTokenAddress = fundStore.fund?.governanceToken.address;
    const fundAddress = fundStore.fund?.address;

    if (fundAddress === ethers.ZeroAddress) {
      toastStore.errorToast(
        "The OIV address is not available. Please contact the Rethink Finance support.",
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
.set_approve_allowance_button {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.divider{
  margin: 1rem auto;
  height: 0.1px;
  width: 100%;
  border: 1px solid rgba(246, 249, 255, 0.08)
}

.title{
  margin: 0 0 0.5rem;
}
.step{
  display: flex;
  align-items: center;
  margin: 0.25rem 0;
  width: fit-content;
}
.button-deposit{
  display: block;
  margin: 0 auto;
}

.is-disabled{
  opacity: 0.5;
}
</style>
