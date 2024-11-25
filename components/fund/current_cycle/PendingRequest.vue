<template>
  <div class="pending_request card_box card_box--no-padding">
    <div class="pending_request__header">
      <div class="pending_request__pending_tokens">
        Pending {{ fundTransactionRequest?.type }} Request
        <div>
          {{ fundTransactionRequestAmountFormatted }} {{ token0?.symbol }}
        </div>
      </div>
      <div class="pending_request__icon_more">
        <v-tooltip activator="parent" location="left">
          <template #activator="{ props }">
            <Icon
              v-bind="props"
              icon="ic:twotone-cancel"
              width="1.5rem"
              @click="toggleCancelButton"
            />
          </template>
          Cancel {{ fundTransactionRequest.type }} Request
        </v-tooltip>
      </div>
      <v-btn
        v-if="showCancelButton"
        v-click-outside="hideCancelButton"
        :disabled="isLoadingCancelRequest"
        class="pending_request__cancel_button bg-primary text-secondary"
        @click="cancelPendingRequest"
      >
        <template #prepend>
          <v-progress-circular
            v-if="isLoadingCancelRequest"
            class="d-flex"
            size="20"
            width="3"
            indeterminate
          />
        </template>
        Cancel {{ fundTransactionRequest.type }} Request
      </v-btn>
    </div>
    <div class="pending_request__header pending_request__header--bg-light">
      <div>
        Claimable
      </div>
      <div class="pending_request__available_token">
        {{ claimableTokenValue }} {{ token1?.symbol }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers, FixedNumber } from "ethers";
import { ref } from "vue";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type IToken from "~/types/token";
import { roundToSignificantDecimals } from "~/composables/formatters";
import { encodeFundFlowsCallFunctionData } from "assets/contracts/fundFlowsCallAbi";

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
    console.warn("fund encodedFunctionCall", encodedFunctionCall)
    await fundStore.fundContract
      .send("fundFlowsCall", {}, encodedFunctionCall)
      .on("transactionHash", (hash: string) => {
        console.log("tx hash: " + hash);
        toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
      }).on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);

        if (receipt.status) {
          toastStore.successToast(
            `Cancellation of a ${props.fundTransactionRequest.type} request was successful.`,
          );
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
.pending_request {
  display: flex;
  color: $color-light-subtitle;
  font-size: $text-sm;

  &__available_token {
    color: $color-white;
  }
  &__pending_tokens {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }
  &__cancel_button {
    position: absolute;
    right: 32px;
    top: 0;
    z-index: 3000;
  }
  &__icon_more {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    //color: $color-moonlight-light;
    color: $color-error;
    :hover {
      //color: lighten($color-moonlight-light, 10%);
      color: darken($color-error, 10%);
    }
  }
  &__header {
    position: relative;
    width: 100%;
    min-height: 2rem;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    border-bottom: 1px solid $color-gray-transparent;
    line-height: 1;
    padding: 0.5rem 2rem 0.5rem 1rem;

    &--bg-light {
      background: $color-gray-light-transparent;
    }
  }
}
</style>
