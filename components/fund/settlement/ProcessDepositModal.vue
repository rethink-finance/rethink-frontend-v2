<template>
  <UiConfirmDialog
    :model-value="modelValue"
    :title="modalTitle"
    max-width="480px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- The amount is the headline: it is the number the depositor is about to
         commit, and the flow it is committed through is the label above it. -->
    <template #title>
      <div class="deposit_head">
        <div class="deposit_head__eyebrow">
          Deposit flow
          <span class="deposit_head__step">
            Step {{ stepNumber }} of {{ stepsDeposit.length }}
          </span>
        </div>
        <div v-if="headlineAmount" class="deposit_head__amount">
          {{ headlineAmount }}
          <span class="deposit_head__symbol">{{ baseSymbol }}</span>
          <template v-if="fundSymbol">
            <span class="deposit_head__arrow">→</span>
            <span class="deposit_head__symbol">{{ fundSymbol }}</span>
          </template>
        </div>
      </div>
    </template>

    <!-- A deposit takes several wallet confirmations — four transactions, or
         a batched confirmation plus processing when the wallet can batch —
         and the only question worth answering here is "where am I?". So the
         steps carry their own state rather than being a numbered list that
         never changes. -->
    <div class="deposit_flow">
      <div class="deposit_flow__bar">
        <span
          v-for="(step, index) in stepsDeposit"
          :key="`seg-${index}`"
          class="deposit_flow__segment"
          :class="{
            'deposit_flow__segment--done': step.done,
            'deposit_flow__segment--current': index === currentStepIndex,
          }"
        />
      </div>

      <div
        v-for="(step, index) in stepsDeposit"
        :key="index"
        class="deposit_flow__step"
        :class="{
          'deposit_flow__step--done': step.done,
          'deposit_flow__step--current': index === currentStepIndex,
          'deposit_flow__step--blocked': step.isDisabled,
        }"
      >
        <v-tooltip
          :disabled="!step.isDisabled"
          location="top"
        >
          <template #default>
            {{ step.tooltip }}
          </template>
          <template #activator="{ props }">
            <div v-bind="props" class="deposit_flow__row">
              <span class="deposit_flow__marker">
                <v-progress-circular
                  v-if="step.loading"
                  size="13"
                  width="2"
                  indeterminate
                />
                <Icon
                  v-else-if="step.done"
                  icon="material-symbols:check"
                  height="0.875rem"
                  width="0.875rem"
                />
                <template v-else>{{ index + 1 }}</template>
              </span>
              <span class="deposit_flow__label">{{ step.label }}</span>
              <span class="deposit_flow__state">{{ stepState(step, index) }}</span>
            </div>
          </template>
        </v-tooltip>
      </div>
    </div>

    <div class="buttons_group">
      <!-- The flow is done and the dialog is still up, so it has to say so —
           otherwise it reads as a form waiting for another signature. -->
      <template v-if="hasProcessedDeposit">
        <div class="deposit_done">
          <Icon
            icon="material-symbols:check"
            class="deposit_done__icon"
            height="1rem"
            width="1rem"
          />
          <span>
            Deposit processed. Your {{ fundSymbol }} balance has been updated.
          </span>
        </div>

        <v-btn
          class="button bg-primary text-secondary"
          @click="$emit('update:modelValue', false)"
        >
          Close
        </v-btn>
      </template>
      <template v-else-if="!hasDelegatedToSelf && hasApprovedAmount">
        <v-btn
          class="button bg-primary text-secondary"
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
          Delegate to myself
        </v-btn>

        <FundGovernanceModalDelegateVotes
          v-model="isDelegateModalOpen"
        />

      </template>
      <template v-else-if="canUserProcessDeposit || shouldUserWaitSettlementOrCancelDeposit">
        <p v-if="shouldUserWaitSettlementOrCancelDeposit" class="buttons_group__note">
          Wait for settlement or cancel the deposit request.
        </p>
        <p v-else-if="canUserProcessDeposit" class="buttons_group__note">
          You can now process or cancel the deposit request.
        </p>

        <v-btn
          class="button bg-primary text-secondary"
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
          Process deposit
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
      <!-- Processing consumes the request, which puts the vault straight back
           into "should request a deposit" — so without the guard the finished
           flow offers to start another one under its own Close button. -->
      <template v-for="button in buttons">
        <v-tooltip
          v-if="button.isVisible && !hasProcessedDeposit"
          :key="button.name"
          :disabled="!button.tooltipText"
          bottom
        >
          <template #default>
            {{ button.tooltipText }}
          </template>
          <template #activator="{ props }">
            <span v-bind="props" class="buttons_group__wrap">
              <v-btn
                class="button bg-primary text-secondary"
                :disabled="button.disabled"
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
import { useDepositBatch } from "~/composables/fund/useDepositBatch";
import { useDepositFlowProcessed } from "~/composables/fund/useDepositFlow";
import {
  isWalletRpcHealthError,
  WALLET_RPC_HEALTH_MESSAGE,
} from "~/services/eip5792";
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

const {
  isDepositBatchPending,
  isBatchSupported,
  refreshBatchSupport,
  sendDepositBatch,
} = useDepositBatch();

/**
 * Set once the deposit lands, and cleared when the dialog is opened again.
 * Nothing on chain records that a request was processed — the request is simply
 * consumed — so the completed state has to be held for as long as the
 * depositor is still looking at it. It is held outside this component because
 * consuming the request swaps the card that renders this dialog, taking any
 * local state with it — see useDepositFlowProcessed.
 */
const hasProcessedDeposit = useDepositFlowProcessed(
  () => fundStore.selectedFundAddress,
);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      hasProcessedDeposit.value = false;
      // Shapes the rail below: with a batching wallet the first three rows
      // collapse into one confirmation.
      refreshBatchSupport();
    }
  },
);

/**
 * Step one's completion normally arrives through the send's receipt event, and
 * that event is not guaranteed: a wallet's receipt polling can die quietly, and
 * the error path refetches from a node that may not have caught up with the
 * transaction yet. Either way the store is left saying "no request" while the
 * chain holds one, and the dialog sits on step one forever — signing again is
 * the only way out, and that sends a second real transaction.
 *
 * So while the dialog is open and claiming step one is not done, the chain is
 * re-read every few seconds (two storage slots). Whichever way the receipt was
 * lost, the request surfaces on the next poll and the flow moves to step two.
 * The poll stops the moment the request appears or the dialog closes.
 */
const requestPollTimer = ref<ReturnType<typeof setInterval>>();
watch(
  () => props.modelValue && shouldUserRequestDeposit.value,
  (shouldPoll) => {
    clearInterval(requestPollTimer.value);
    requestPollTimer.value = undefined;
    if (shouldPoll) {
      requestPollTimer.value = setInterval(
        () => fundStore.fetchUserFundDepositRedemptionRequests(),
        5000,
      );
    }
  },
  { immediate: true },
);
onUnmounted(() => clearInterval(requestPollTimer.value));

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
    return `Deposit flow · ${depositRequestAmountFormatted.value} ${baseToken.symbol}`;
  }

  // If we're in the request deposit phase and have a token value, show that
  if (shouldUserRequestDeposit.value && props.tokenValue && baseToken) {
    return `Deposit flow · ${props.tokenValue} ${baseToken.symbol}`;
  }

  // Default title
  return "Deposit flow";
});

const baseSymbol = computed(() => fundStore.fund?.baseToken?.symbol ?? "");
const fundSymbol = computed(() => fundStore.fund?.fundToken?.symbol ?? "");

/**
 * What the depositor is committing. The request's own amount once it exists —
 * the form can be edited after the request is made, and the number on screen
 * has to be the one the chain is holding.
 */
const headlineAmount = computed(() => {
  if (userDepositRequestExists.value && userDepositRequest?.value?.amount) {
    return depositRequestAmountFormatted.value;
  }
  return props.tokenValue || "";
});

const handleError = (error: any, refreshData: boolean = true) => {
  loadingRequestDeposit.value = false;
  loadingApproveAllowance.value = false;
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.");
  } else if (isWalletRpcHealthError(error)) {
    // The wallet's endpoint refused the send before anything was signed;
    // nothing on-chain changed, so no refresh — just the remedy.
    console.error(error);
    toastStore.errorToast(WALLET_RPC_HEALTH_MESSAGE);
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

/**
 * The batched form of the button below: request + approve + delegate in one
 * EIP-5792 confirmation when the wallet can execute it, and the plain
 * requestDeposit when it cannot. "stopped" means the batch already told the
 * user what happened, so nothing else runs.
 */
const requestDepositBatchFirst = async () => {
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.");
    return;
  }
  const tokensWei = ethers.parseUnits(
    props.tokenValue || "0",
    fund.value?.baseToken.decimals,
  );
  const outcome = await sendDepositBatch(tokensWei);
  if (outcome === "unsupported") {
    await requestDeposit();
  } else if (outcome === "success") {
    emit("deposit-success");
  }
};

const isRequestDepositDisabled = computed(() => {
  return (
    props.visibleErrorMessages.length > 0 ||
    loadingRequestDeposit.value || loadingApproveAllowance.value ||
    isDepositBatchPending.value ||
    !fundStore.isUserWalletWhitelisted
  );
});

const isRequestDepositLoading = computed(
  () => loadingRequestDeposit.value || isDepositBatchPending.value,
);

const buttons = ref([
  {
    name: "Request deposit",
    onClick: requestDepositBatchFirst,
    isVisible: shouldUserRequestDeposit,
    disabled: isRequestDepositDisabled,
    loading: isRequestDepositLoading,
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
    name: "Approve amount",
    onClick: approveAllowance,
    loading: loadingApproveAllowance,
    isVisible: shouldUserApproveAllowance,
    tooltipText: undefined,
  },
]);

/**
 * The numbers are drawn by the markers now, so they are not in the labels.
 *
 * Processing a deposit consumes the request the earlier steps are read from, so
 * the moment it lands every one of those flags goes false again. Held open past
 * that, the rail would reset to step one and read as though nothing had
 * happened — hence the completed flag standing in for all four.
 *
 * While an EIP-5792 batch is confirming, the first three steps really are in
 * flight in one transaction, so each not-yet-done one spins; a step the batch
 * skipped because it was already satisfied stays a plain check.
 *
 * The rail's shape follows the wallet: one that batches signs request,
 * approval and delegation as a single confirmation, so drawing them as three
 * steps promises three prompts that never come — they collapse into one row,
 * and the flow honestly reads as two steps. Wallets that answer the probe
 * with "cannot" (or not at all) keep the four-row rail that matches the four
 * prompts they will actually see.
 */
interface IDepositStep {
  label: string;
  done: boolean;
  loading?: boolean;
  isDisabled?: boolean;
  tooltip?: string;
}

const stepsDeposit = computed<IDepositStep[]>(() => {
  const complete = hasProcessedDeposit.value;
  const batchPending = isDepositBatchPending.value;

  const processStep: IDepositStep = {
    label: "Process deposit",
    done: complete,
    loading: isLoadingProcessDeposit.value,
    isDisabled:
      !complete &&
      shouldUserWaitSettlementOrCancelDeposit.value &&
      hasDelegatedToSelf.value,
    tooltip: "Wait for the next NAV update to process the deposit.",
  };

  if (isBatchSupported.value) {
    return [
      {
        label: "Request, approve & delegate",
        done:
          complete ||
          (userDepositRequestExists.value &&
            hasApprovedAmount.value &&
            hasDelegatedToSelf.value),
        loading:
          batchPending ||
          loadingRequestDeposit.value ||
          loadingApproveAllowance.value ||
          isLoadingDelegate.value,
        isDisabled: false,
      },
      processStep,
    ];
  }

  return [
    {
      label: "Request deposit",
      done: complete || userDepositRequestExists.value,
      loading:
        loadingRequestDeposit.value ||
        (batchPending && !userDepositRequestExists.value),
      isDisabled: false,
    },
    {
      label: "Approve amount",
      done: complete || hasApprovedAmount.value,
      loading:
        loadingApproveAllowance.value ||
        (batchPending && !hasApprovedAmount.value),
      isDisabled: false,
    },
    {
      label: "Delegate to myself",
      done: complete || (hasDelegatedToSelf.value && hasApprovedAmount.value),
      loading:
        isLoadingDelegate.value ||
        (batchPending && !hasDelegatedToSelf.value),
    },
    processStep,
  ];
});

/**
 * Where the depositor is: the first step still outstanding. The steps are
 * strictly sequential, so anything before it is finished and anything after it
 * has not been reached.
 */
const currentStepIndex = computed(() =>
  stepsDeposit.value.findIndex((step) => !step.done),
);

/** Counts from one, and stops at the last step rather than running past it. */
const stepNumber = computed(() =>
  currentStepIndex.value === -1
    ? stepsDeposit.value.length
    : currentStepIndex.value + 1,
);

/**
 * A word per row, so the rail says what each step is doing and not only where
 * it sits. "Waiting" is left off the steps further down — four rows all
 * saying the same thing is noise, and their dimming already says it.
 */
const stepState = (step: { done?: boolean; loading?: boolean; isDisabled?: boolean }, index: number) => {
  if (step.loading) return "Signing";
  if (step.done) return "Done";
  if (step.isDisabled) return "Locked";
  return index === currentStepIndex.value ? "Now" : "";
};

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
          // The dialog stays up: every other step in this flow leaves it open,
          // and the last one closing out from under the depositor takes the
          // record of what just happened with it.
          hasProcessedDeposit.value = true;

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
          isWalletRpcHealthError(error)
            ? WALLET_RPC_HEALTH_MESSAGE
            : "There has been an error. Please contact the Rethink Finance support.",
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
          isWalletRpcHealthError(error)
            ? WALLET_RPC_HEALTH_MESSAGE
            : "There has been an error. Please contact the Rethink Finance support.",
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
/**
 * Label above, figure below: the eyebrow names the flow and carries the
 * position in it, and the amount gets the weight because it is the thing being
 * committed.
 */
.deposit_head {
  min-width: 0;

  &__eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__step {
    padding: 0.0625rem 0.375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: $color-text-irrelevant;
  }

  &__amount {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: $color-white;
  }

  &__symbol {
    font-family: $font-mono;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: $color-text-irrelevant;
  }

  &__arrow {
    font-size: 13px;
    color: $color-steel-blue;
  }
}

.buttons_group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;

  /* One action at a time, so it takes the width rather than sitting as a small
     outline in the middle of a large dialog. */
  .button {
    width: 100%;
    min-height: 2.75rem;
    font-weight: 600;
  }

  &__wrap {
    display: block;
    width: 100%;
  }

  &__note {
    margin: 0;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}

/* The outcome, in the accent the finished steps above it are already using. */
.deposit_done {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid $color-accent-line;
  border-radius: $default-border-radius;
  background: $color-accent-soft;
  font-size: $text-sm;
  line-height: 1.5;
  color: $color-light-subtitle;

  &__icon {
    flex: none;
    margin-top: 0.125rem;
    color: $color-cyan;
  }
}

/**
 * The four transactions as a rail: done above, current in front of you,
 * the rest waiting. The connecting line is what makes it a sequence rather
 * than a list of options.
 */
.deposit_flow {
  margin-bottom: 1.75rem;

  /**
   * One segment per transaction, filling as they land. The rail below says
   * which step is which; this says how much of the flow is left, which is the
   * question being asked before the wallet opens.
   */
  &__bar {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
  }

  &__segment {
    flex: 1 1 0;
    height: 3px;
    border-radius: 999px;
    background: $color-line-2;
    transition: background-color $default-transition-time ease;

    &--done {
      background: $color-cyan-raw;
    }

    &--current {
      background: $color-accent-line;
    }
  }

  &__step {
    position: relative;

    &:not(:last-child) {
      padding-bottom: 0.875rem;

      /* Joins the markers rather than running the height of the row, so the
         rail reads as one line threaded through them. */
      &::after {
        content: "";
        position: absolute;
        left: 0.75rem;
        top: 1.625rem;
        bottom: 0.1875rem;
        width: 1px;
        margin-left: -0.5px;
        background: $color-line-2;
      }
    }

    &--done {
      /* Matches the specificity of the base connector rule above, which is
         written with :not(:last-child) and would otherwise win. */
      &:not(:last-child)::after {
        background: $color-accent-line;
      }

      .deposit_flow__marker {
        color: $color-cyan;
        border-color: $color-accent-line;
        background: $color-accent-soft;
      }

      .deposit_flow__label {
        color: $color-text-irrelevant;
      }

      .deposit_flow__state {
        color: $color-cyan;
      }
    }

    &--current {
      .deposit_flow__marker {
        color: $color-cyan;
        border-color: $color-cyan;
        /* A flat ring, not a blur: it lifts the live step off the rail without
           putting a shadow into a design that has one. */
        box-shadow: 0 0 0 4px $color-accent-soft;
      }

      .deposit_flow__label {
        color: $color-white;
        font-weight: 600;
      }

      .deposit_flow__state {
        color: $color-cyan;
      }
    }

    /* Reachable, but not yet — the tooltip on the row says why. */
    &--blocked {
      opacity: 0.5;
    }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__marker {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1;
    color: $color-steel-blue;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease,
      box-shadow $default-transition-time ease;
  }

  &__label {
    font-size: $text-sm;
    color: $color-steel-blue;
  }

  /* Pushed to the right edge so the words line up in a column of their own. */
  &__state {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}
</style>
