<template>
  <div class="pending_request">
    <div class="pending_request__head">
      <span class="pending_request__kind">
        {{ fundTransactionRequest?.type }} request
      </span>

      <!-- Cancelling costs a transaction and cannot be undone, so the control
           asks twice — in place, rather than by revealing a button on top of
           the card. Clicking anywhere else takes the question back. -->
      <button
        v-click-outside="hideCancelButton"
        type="button"
        class="pending_request__cancel"
        :class="{ 'pending_request__cancel--armed': showCancelButton }"
        :disabled="isLoadingCancelRequest"
        @click="showCancelButton ? cancelPendingRequest() : toggleCancelButton()"
      >
        <v-progress-circular
          v-if="isLoadingCancelRequest"
          size="12"
          width="2"
          indeterminate
        />
        {{ showCancelButton ? "Confirm cancel" : "Cancel" }}
      </button>
    </div>

    <div class="pending_request__amount">
      {{ fundTransactionRequestAmountFormatted }}
      <span class="pending_request__amount_symbol">{{ token0?.symbol }}</span>
    </div>

    <div class="pending_request__claimable">
      <span class="pending_request__claimable_label">Claimable</span>
      <span class="pending_request__claimable_value">
        {{ claimableTokenValue }} {{ token1?.symbol }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";
import { ethers, FixedNumber } from "ethers";
import { ref } from "vue";
import { roundToSignificantDecimals } from "~/composables/formatters";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type IToken from "~/types/token";

const emit = defineEmits(["cancel-request-success"]);

const fundStore = useFundStore();
const toastStore = useToastStore();
const showCancelButton = ref(false);

const toggleCancelButton = () => {
  showCancelButton.value = !showCancelButton.value;
}
const hideCancelButton = () => {
  showCancelButton.value = false;
}
const props = defineProps({
  fundTransactionRequest: {
    type: Object as PropType<IFundTransactionRequest>,
    default: () => {},
  },
  token0: {
    type: Object as PropType<IToken>,
    default: () => {
    },
  },
  token1: {
    type: Object as PropType<IToken>,
    default: () => {
    },
  },
  exchangeRate: {
    type: FixedNumber,
    default: FixedNumber.fromValue(0),
  },
});

const fundTransactionRequestAmountFormatted = computed(() => {
  return formatTokenValue(props.fundTransactionRequest.amount, props.token0.decimals, false);
});
const claimableTokenValue = computed(() => {
  if (!props.exchangeRate) return 0
  console.log("exchangeRate:", props.exchangeRate)
  const amount = ethers.formatUnits(props.fundTransactionRequest.amount, props.token0.decimals);
  const value = props.exchangeRate.mul(FixedNumber.fromString(amount));
  return roundToSignificantDecimals(value.toString(), 3);
});

const isLoadingCancelRequest = ref(false);

const cancelPendingRequest = async () => {
  if (!fundStore.activeAccountAddress) {
    toastStore.errorToast("Connect your wallet to cancel the deposit.")
    return;
  }
  const isDepositRequest = props.fundTransactionRequest.type === FundTransactionType.Deposit;
  console.log(`Cancel ${props.fundTransactionRequest.type} Request`);
  isLoadingCancelRequest.value = true;

  const encodedFunctionCall = encodeFundFlowsCallFunctionData(
    "revokeDepositWithrawal",
    [ isDepositRequest ],
  );

  try {
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
      }).on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        if (receipt.status) {
          toastStore.successToast(
            `Cancellation of a ${props.fundTransactionRequest.type} request was successful.`,
          );
          emit("cancel-request-success");
          if (isDepositRequest) {
            fundStore.fundUserData.depositRequest = undefined;
          } else {
            fundStore.fundUserData.redemptionRequest = undefined;
          }
        } else {
          fundStore.fetchUserFundDepositRedemptionRequests();
          toastStore.errorToast(
            "Your deposit request has failed. Please contact the Rethink Finance support.",
          );
        }
        isLoadingCancelRequest.value = false;
        hideCancelButton();
      }).on("error", (error: any) => {
        console.error(error);
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      })
  } catch (error: any) {
    handleError(error);
  }
}

const handleError = (error: any, refreshData: boolean=true) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  isLoadingCancelRequest.value = false;
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
    if (refreshData) {
      fundStore.fetchUserFundDepositRedemptionRequests();
    }
  }
}
</script>

<style lang="scss" scoped>
/**
 * One outstanding request, read top to bottom: what it is, how much, and what
 * it turns into. The amount carries the weight — it is the only thing here a
 * depositor has to check — so it is set large and the rest recedes.
 */
.pending_request {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-navy-gray-light;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__kind {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  /* Quiet until asked, then red: the destructive step is the one that should
     look destructive, not the way in to it. */
  &__cancel {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem -0.25rem 0;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
    background: none;
    border: 1px solid transparent;
    border-radius: $default-border-radius;
    white-space: nowrap;
    cursor: pointer;
    transition: color $default-transition-time ease,
      border-color $default-transition-time ease;

    &:hover:not(:disabled) {
      color: $color-error;
    }

    &--armed {
      color: $color-error;
      border-color: $color-error;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }

  &__amount {
    font-family: $font-mono;
    font-size: 21px;
    font-weight: 500;
    line-height: 1.1;
    color: $color-white;
    overflow-wrap: anywhere;
  }

  &__amount_symbol {
    font-size: 13px;
    color: $color-steel-blue;
  }

  &__claimable {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid $color-line;
  }

  &__claimable_label {
    flex: none;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  /* A claimable figure can run to a dozen decimals when the share price is
     tiny; let it wrap rather than push the label off the card. */
  &__claimable_value {
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;
    text-align: right;
    overflow-wrap: anywhere;
  }
}
</style>
