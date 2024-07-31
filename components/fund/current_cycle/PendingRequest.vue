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
        <Icon name="material-symbols:more-vert" width="1.5rem" />
      </div>
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

import type IFundTransactionRequest from "~/types/fund_transaction_request";
import type IToken from "~/types/token";
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
  return formatTokenValue(props.fundTransactionRequest.amount, props.token0.decimals);
});
const claimableTokenValue = computed(() => {
  if (!props.exchangeRate) return "N/A"
  // Continue to use your trimTrailingZeros utility function as needed
  return trimTrailingZeros((Number(props.fundTransactionRequest.amount) * props.exchangeRate).toFixed(4));
});
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
  &__icon_more {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    color: $color-moonlight-light;

    :hover {
      color: lighten($color-moonlight-light, 10%);
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
