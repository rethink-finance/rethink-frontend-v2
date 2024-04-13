<template>
  <div class="request_deposit">
    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="IconQuestionCircle" size="1rem" />
          <v-tooltip v-if="token0" activator="parent" location="right">
            {{ token0.symbol }} ({{ token0.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token0.symbol }}
        </div>
        <div class="request_deposit__token_col pa-0 request_deposit__token_col--dark text-end">
          <InputNumber
            v-model="tokenValue"
            :rules="tokenValueRules"
            class="request_deposit__input_amount"
          />
        </div>
      </div>
      <div class="request_deposit__balance">
        Balance: {{ token0UserBalanceFormatted }} {{ token0.symbol }}
      </div>
    </div>

    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="IconQuestionCircle" size="1rem" />
          <v-tooltip v-if="token1" activator="parent" location="right">
            {{ token1.symbol }} ({{ token1.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token1.symbol }}
        </div>
        <div class="request_deposit__token_col text-end">
          ≈ {{ calculatedToken1Value }}
        </div>
      </div>
      <div class="request_deposit__balance">
        <div>
          Balance: {{ token1UserBalanceFormatted }} {{ token1.symbol }}
        </div>
        <div>
          Last NAV Update Value: {{ exchangeRateText }}
        </div>
      </div>
    </div>
    <div class="buttons_container">
      <slot name="buttons" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import type IToken from "~/types/token";

type RuleFunction = (...args: any[]) => boolean | string;
type RulesArray = RuleFunction[];

const props = defineProps({
  modelValue: {
    type: String,
    default: "0",
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
  token0UserBalance: {
    type: [Number, BigInt] as PropType<number | bigint>,
    default: BigInt("0"),
  },
  token1UserBalance: {
    type: [Number, BigInt] as PropType<number | bigint>,
    default: BigInt("0"),
  },
  rules: {
    type: Array as PropType<RulesArray>,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);


const tokenValue = computed({
  get: () => props?.modelValue ?? "0",
  set: (value: string) => {
    emit("update:modelValue", value);
  },
});

// Merge default rules with custom provided rules.
const tokenValueRules = [
  // TODO Add rule for max decimals
  (value: string) => {
    const valueWei = ethers.parseUnits(value, props.token0.decimals);
    if (valueWei <= 0) return "Value must be positive."
    return true;
  },
  ...props.rules,
];

const token0UserBalanceFormatted = computed(() => {
  return formatTokenValue(props.token0UserBalance, props.token0.decimals);
});
const token1UserBalanceFormatted = computed(() => {
  return formatTokenValue(props.token1UserBalance, props.token0.decimals);
});

const exchangeRate = computed(() => {
  // TODO exchange rate should come from last NAV update
  return 1;
});

const exchangeRateText = computed(() => {
  // Make sure to handle potential reactivity or null checks as needed
  return `1 ${props.token0.symbol} = ${exchangeRate.value.toFixed(2)} ${props.token1.symbol}`;
});

const calculatedToken1Value = computed(() => {
  // Continue to use your trimTrailingZeros utility function as needed
  return trimTrailingZeros((Number(tokenValue.value) * exchangeRate.value).toFixed(4));
});
</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}
.request_deposit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-size: $text-sm;
  line-height: 1;

  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
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
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
