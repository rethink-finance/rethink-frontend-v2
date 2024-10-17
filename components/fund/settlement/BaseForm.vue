<template>
  <div class="request_deposit">
    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon icon="octicon:question-16" width="1rem" />
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
      <div class="request_deposit__balance request_deposit__balance--row">
        Balance:
        <strong
          class="set_token_value_button mx-1"
          @click="setTokenValue(token0UserBalanceFormatted)"
        >
          {{ token0UserBalanceFormatted }} {{ token0.symbol }}
        </strong>
      </div>
    </div>

    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon icon="octicon:question-16" width="1rem" />
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
          Balance:
          <strong>{{ token1UserBalanceFormatted }} {{ token1.symbol }}</strong>
        </div>
        <div v-if="fundStore.fundLastNAVUpdate">
          Based on Last NAV Update:
          <div>
            <strong>
              {{ exchangeRateText }}
            </strong>
          </div>
        </div>
        <div v-else>
          There was no NAV update yet: 1 {{ token0?.symbol }} = {{ noNavUpdateToken1Value }} {{ token1?.symbol }}
        </div>
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
import { useFundStore } from "~/store/fund.store";

type RuleFunction = (...args: any[]) => boolean | string;
type RulesArray = RuleFunction[];

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
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
  rules: {
    type: Array as PropType<RulesArray>,
    default: () => [],
  },
});
const fundStore = useFundStore();

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
  const value = props.exchangeRate.mul(FixedNumber.fromValue(tokenValue.value));
  return trimTrailingZeros(value.toString());
});
const noNavUpdateToken1Value = computed(() => {
  if (!props?.token0?.decimals || !props?.token1?.decimals) return "--";
  // If there was no NAV update, the exchange rate is 1:1 if the token0 decimals are the same as token1 decimals.
  // If decimals are different, the ratio equals to token0 decimals / token1 decimals.
  const decimals = Number(props.token1.decimals - props.token0.decimals)
  const exchangeRate = 10 ** -decimals;
  return trimTrailingZeros(exchangeRate.toFixed(18));
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

    &--row {
      gap: 0.15rem;
      align-items: center;
      flex-direction: row;
    }
    .set_token_value_button {
      &:hover {
        cursor: pointer;
        text-decoration: underline;
      }
    }
  }
}
</style>
