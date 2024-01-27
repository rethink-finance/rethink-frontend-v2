<template>
  <div class="request_deposit">
    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="QuestionCircleIcon" size="1rem" />
          <v-tooltip v-if="token0" activator="parent" location="right">
            {{ token0.name }} ({{ token0.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token0.name }}
        </div>
        <div class="request_deposit__token_col pa-0 request_deposit__token_col--dark text-end">
          <InputNumber
            v-model="tokenValue"
            class="request_deposit__input_amount"
          />
        </div>
      </div>
      <div class="request_deposit__balance">
        Balance: {{ token0.balance }} {{ token0.name }}
      </div>
    </div>

    <div class="request_deposit__token">
      <div class="request_deposit__token_header">
        Token
        <span>
          <Icon name="QuestionCircleIcon" size="1rem" />
          <v-tooltip v-if="token1" activator="parent" location="right">
            {{ token1.name }} ({{ token1.address }}).
          </v-tooltip>
        </span>
      </div>

      <div class="request_deposit__token_data">
        <div class="request_deposit__token_col">
          {{ token1.name }}
        </div>
        <div class="request_deposit__token_col text-end">
          ≈ {{ calculatedToken1Value }}
        </div>
      </div>
      <div class="request_deposit__balance">
        <div>
          Balance: {{ token1.balance }} {{ token1.name }}
        </div>
        <div>
          Last NAV Update Value: {{ exchangeRateText }}
        </div>
      </div>
    </div>

    <div class="request_deposit__button">
      <v-btn class="bg-primary text-secondary">
        {{ buttonText }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
import type IToken from "~/types/token";

export default {
  name: "DepositRedeem",
  props: {
    action: {
      type: String,
      validator: function (value: string) {
        // Validate that the value is one of the allowed values
        return ["deposit", "redeem", ""].includes(value);
      },
      default: "deposit",
    },
    token0: {
      type: Object as PropType<IToken>,
      default: () => {},
    },
    token1: {
      type: Object as PropType<IToken>,
      default: () => {},
    },
  },
  data() {
    return {
      tokenValue: 0,
      rules: [
        (value: number) => {
          if (value <= 0) {
            return "Value must be positive."
          }
          return true
        },
      ],
    }
  },
  computed: {
    exchangeRate() {
      // TODO @dev probably better to get this data from the API.
      return this.token0.balance / this.token1.balance;
    },
    exchangeRateText() {
      // TODO @dev edit this if needed & format.
      return `1 ${this.token0.name} = ${this.exchangeRate.toFixed(2)} ${this.token1.name}`;
    },
    calculatedToken1Value() {
      console.log("this.tokenValue");
      console.log(this.tokenValue);
      return (this.tokenValue * this.exchangeRate).toFixed(4).replace(/\.?0*$/, "");
    },
    buttonText() {
      if (this.action === "deposit") {
        return "Request Deposit"
      }
      return "Request Redeem"
    },
  },
};
</script>

<style lang="scss" scoped>
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
  &__button {
    margin: auto;
    margin-top: 0.5rem;
  }
}
</style>
