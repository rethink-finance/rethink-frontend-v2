<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div>
        <div class="section_title">
          {{ fund.nextSettlement }}
        </div>
        <div class="section_subtitle">
          Next Settlement
        </div>
      </div>
      <div class="fund_settlement__buttons">
        <v-btn
          :class="getDepositRedeemButtonClass('deposit')"
          variant="outlined"
          @click="toggleActionButton('deposit')"
        >
          Deposit
          <v-tooltip activator="parent" location="bottom">
            Deposit tokens to the fund.
          </v-tooltip>
        </v-btn>
        <v-btn
          :class="getDepositRedeemButtonClass('redeem')"
          variant="outlined"
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
      <div v-if="selectedActionButtonValue" class="card_box">
        <FundSettlementDepositRedeem
          :action="selectedActionButtonValue"
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
      selectedActionButtonValue: "",
    };
  },
  computed: {
    getToken0(): IToken {
      if (this.selectedActionButtonValue === "deposit") {
        return this.fund.fundToken;
      }
      return this.fund.denominationToken;
    },
    getToken1(): IToken {
      if (this.selectedActionButtonValue === "deposit") {
        return this.fund.denominationToken;
      }
      return this.fund.fundToken;
    },
  },
  methods: {
    toggleActionButton(value: string) {
      console.log("Deposit/Redeem Button clicked!");
      if (this.selectedActionButtonValue === value) {
        this.selectedActionButtonValue = "";
      } else {
        this.selectedActionButtonValue = value;
      }
    },
    getDepositRedeemButtonClass(buttonType: string) {
      // Check if this.selectedActionButtonValue is falsy and return "" if so
      if (!this.selectedActionButtonValue) return "";

      // Return "button-active" if buttonType matches this.selectedActionButtonValue,
      // otherwise return "button-inactive"
      return buttonType === this.selectedActionButtonValue ? "button-active" : "button-inactive";
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
  button {
    color: $color-secondary !important;
    &.button-active {
      color: $color-primary !important;
    }
    &.button-inactive {
      color: $color-inactive !important;
    }
  }
  &__card_boxes {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card_header {
    flex-direction: column;
    gap: 1.5rem;
    @include sm {
      flex-direction: row;
    }
  }
}
</style>
