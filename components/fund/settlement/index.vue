<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div>
        <div class="section_title">
          {{ fund.next_settlement }}
        </div>
        <div class="section_subtitle">
          Next Settlement
        </div>
      </div>
      <div class="fund_settlement__buttons">
        <v-btn
          :class="actionButtonValue === 'deposit' ? 'button-active' : 'text-secondary'"
          :variant="actionButtonValue === 'deposit' ? 'flat' : 'outlined'"
          @click="toggleActionButton('deposit')"
        >
          Deposit
          <v-tooltip activator="parent" location="bottom">
            Deposit tokens to the fund.
          </v-tooltip>
        </v-btn>
        <v-btn
          :class="actionButtonValue === 'redeem' ? 'button-active' : 'text-secondary'"
          :variant="actionButtonValue === 'redeem' ? 'flat' : 'outlined'"
          @click="toggleActionButton('redeem')"
        >
          Redeem
          <v-tooltip activator="parent" location="bottom">
            Redeem tokens from the fund.
          </v-tooltip>
        </v-btn>
      </div>
    </div>
    <div class="fund_settlement__card_boxes">
      <div v-if="actionButtonValue" class="card_box">
        <FundSettlementDepositRedeem
          :action="actionButtonValue"
          :token0="getToken0"
          :token1="getToken1"
        />
      </div>
      <div class="card_box card_box--no-padding">
        <FundSettlementDepositRedeemNotification />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import type IFund from "~/types/fund";
import type IToken from "~/types/token";

export default {
  name: "Settlement",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  data() {
    return {
      actionButtonValue: "",
    };
  },
  computed: {
    getToken0(): IToken {
      if (this.actionButtonValue === "deposit") {
        return this.fund.fund_token;
      }
      return this.fund.denomination_token;
    },
    getToken1(): IToken {
      if (this.actionButtonValue === "deposit") {
        return this.fund.denomination_token;
      }
      return this.fund.fund_token;
    },
  },
  methods: {
    toggleActionButton(value: string) {
      if (this.actionButtonValue === value) {
        this.actionButtonValue = "";
      } else {
        this.actionButtonValue = value;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_settlement {
  &__buttons {
    display: flex;
    gap: 1rem;
    margin: auto 0;
  }
  button.button-active {
    background-color: $color-white !important;
    color: $color-primary !important;
  }
  &__card_boxes {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
}
</style>
