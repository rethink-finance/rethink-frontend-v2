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
import { ethers } from "ethers";
import { ref } from "vue";
import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type IToken from "~/types/token";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";
import { FundTransactionType } from "~/types/enums/fund_transaction_type";
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
    type: Number,
    default: 0,
  },
});

const fundTransactionRequestAmountFormatted = computed(() => {
  return formatTokenValue(props.fundTransactionRequest.amount, props.token0.decimals, false);
});
const claimableTokenValue = computed(() => {
  if (!props.exchangeRate) return 0
  const rate = BigInt(Math.round(props.exchangeRate * 1000));
  const value = props.fundTransactionRequest.amount * rate;
  return formatTokenValue(value / BigInt(1000), props.token0.decimals, false);
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

  const ABI = [ "function revokeDepositWithrawal(bool isDeposit)" ];
  const iface = new ethers.Interface(ABI);
  const encodedFunctionCall = iface.encodeFunctionData("revokeDepositWithrawal", [ isDepositRequest ]);
  const [gasPrice] = await fundStore.estimateGasFundFlowsCall(encodedFunctionCall);

  try {
    await fundStore.fundContract.methods.fundFlowsCall(encodedFunctionCall).send({
      from: fundStore.activeAccountAddress,
      maxPriorityFeePerGas: gasPrice,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");
    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast(
          `Cancellation of a ${props.fundTransactionRequest.type} request was successful.`,
        );
        if (isDepositRequest) {
          fundStore.userDepositRequest = undefined;
        } else {
          fundStore.userRedemptionRequest = undefined;
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
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  isLoadingCancelRequest.value = false;
  if ([4001, 100].includes(error?.code)) {
    toastStore.addToast("Transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
    fundStore.fetchUserFundDepositRedemptionRequests();
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
