<template>
  <div class="request_deposit">
    <div class="request_deposit__field">
      <div class="request_deposit__control">
        <div class="request_deposit__symbol">
          {{ token0.symbol }}
          <v-tooltip
            v-if="token0"
            activator="parent"
            location="top"
            content-class="brand_tooltip"
          >
            <div class="brand_tooltip__label">
              {{ token0.symbol }}
            </div>
            <div class="brand_tooltip__value">
              {{ token0.address }}
            </div>
          </v-tooltip>
        </div>
        <UiInputNumber
          v-model="tokenValue"
          :rules="tokenValueRules"
          hide-details="auto"
          class="request_deposit__input_amount"
        />
      </div>
      <div class="request_deposit__caption">
        Balance ·
        <button
          type="button"
          class="request_deposit__balance_button"
          @click="setTokenValue(token0UserBalanceFormatted)"
        >
          {{ token0UserBalanceFormatted }} {{ token0.symbol }}
        </button>
      </div>
    </div>

    <div class="request_deposit__field">
      <div class="request_deposit__control request_deposit__control--readonly">
        <div class="request_deposit__symbol">
          {{ token1.symbol }}
          <v-tooltip
            v-if="token1"
            activator="parent"
            location="top"
            content-class="brand_tooltip"
          >
            <div class="brand_tooltip__label">
              {{ token1.symbol }}
            </div>
            <div class="brand_tooltip__value">
              {{ token1.address }}
            </div>
          </v-tooltip>
        </div>
        <div class="request_deposit__estimate">
          ≈
          <v-progress-circular
            v-if="isExchangeRateLoading"
            size="14"
            width="2"
            indeterminate
          />
          <template v-else>
            {{ calculatedToken1Value }}
          </template>
        </div>
      </div>
      <div class="request_deposit__caption">
        Balance · {{ token1UserBalanceFormatted }} {{ token1.symbol }}
      </div>
      <div v-if="isExchangeRateLoading" class="request_deposit__caption">
        <v-skeleton-loader type="text" class="request_deposit__text_skeleton" />
      </div>
      <div v-else class="request_deposit__caption">
        {{ exchangeRateText }}
      </div>
    </div>

    <div class="buttons_container">
      <slot name="buttons" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers, FixedNumber } from "ethers";
import type { PropType } from "vue";
import type IToken from "~/types/token";

type RuleFunction = (...args: any[]) => boolean | string;
type RulesArray = RuleFunction[];

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  token0: {
    type: Object as PropType<IToken>,
    default: () => {},
  },
  token1: {
    type: Object as PropType<IToken>,
    default: () => {},
  },
  token0UserBalance: {
    type: BigInt as unknown as PropType<bigint>,
    default: BigInt("0"),
  },
  token1UserBalance: {
    type: BigInt as unknown as PropType<bigint>,
    default: BigInt("0"),
  },
  exchangeRate: {
    type: FixedNumber,
    default: FixedNumber.fromValue(0),
  },
  isExchangeRateLoading: {
    type: Boolean,
    default: false,
  },
  rules: {
    type: Array as PropType<RulesArray>,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);

const tokenValue = computed({
  get: () => props?.modelValue ?? "",
  set: (value: string) => {
    emit("update:modelValue", value);
  },
});

const setTokenValue = (value: any) => {
  tokenValue.value = value;
}

// Merge default rules with custom provided rules.
const tokenValueRules = [
  (value: string) => {
    let valueWei;
    try {
      valueWei = ethers.parseUnits(value || "0", props.token0.decimals);
    } catch {
      return `Make sure the value has max ${props.token0.decimals} decimals.`
    }
    if (valueWei <= 0) return "Value must be positive."
    return true;
  },
  ...props.rules,
];

const token0UserBalanceFormatted = computed(() => {
  return formatTokenValue(props.token0UserBalance, props.token0.decimals, false);
});
const token1UserBalanceFormatted = computed(() => {
  return formatTokenValue(props.token1UserBalance, props.token1.decimals,false);
});

const exchangeRateText = computed((): string => {
  return getExchangeRateText(props.exchangeRate, props.token0.symbol, props.token1.symbol)
});

const calculatedToken1Value = computed(() => {
  if (!tokenValue.value) return "0"
  if (!props.exchangeRate || !tokenValue.value || !props.token0.decimals) return "N/A"

  try {
    const value = props.exchangeRate.mul(FixedNumber.fromString(tokenValue.value.toString()));
    return trimTrailingZeros(value.toString());
  } catch (error: any) {
    console.error("error calculatedToken1Value", error);
    return "0";
  }
});
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}

/**
 * Deposit / redeem form, following the design's amount control: the token
 * symbol lives in a raised prefix box welded to the input, and the balance and
 * rate sit under it as mono captions rather than labelled fields.
 */
.request_deposit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__control {
    display: flex;
    align-items: stretch;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    overflow: hidden;

    /* The estimated output is derived, never typed into — the flatter fill
       marks it as read-only without needing a disabled input. */
    &--readonly {
      background: rgba(255, 255, 255, 0.015);
    }
  }

  &__symbol {
    display: flex;
    align-items: center;
    min-width: 58px;
    padding: 0.625rem 0.875rem;
    background: $color-navy-gray-light;
    border-right: 1px solid $color-line-2;
    font-family: $font-mono;
    font-size: 13px;
    color: $color-text-irrelevant;
    cursor: help;
  }

  &__estimate {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    flex: 1;
    padding: 0.625rem 0.875rem;
    font-family: $font-mono;
    font-size: 14px;
    color: $color-text-irrelevant;
  }

  &__input_amount {
    flex: 1;
    min-width: 0;

    :deep(.v-field) {
      background: transparent;
      box-shadow: none;
    }

    :deep(.v-field__input) {
      min-height: 0;
      padding: 0.625rem 0.875rem;
    }

    :deep(input) {
      font-family: $font-mono;
      font-size: 14px;
      color: $color-white;
    }

    :deep(.v-input__details) {
      padding-inline: 0;
    }
  }

  &__caption {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
  }

  &__balance_button {
    font-family: inherit;
    font-size: inherit;
    color: $color-cyan;
    transition: color $default-transition-time ease;

    &:hover {
      color: $color-cyan-soft;
    }
  }

  &__text_skeleton {
    max-width: 15rem;
    background: transparent;

    ::v-deep(.v-skeleton-loader__text) {
      margin: 0.25rem 0;
    }
  }
}
</style>
