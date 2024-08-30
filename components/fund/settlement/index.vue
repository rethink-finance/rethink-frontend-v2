<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div class="card_header__title">
        Manage Deposits & align design with My Deposits
      </div>
      <div class="fund_settlement__buttons">
        <v-btn
          :class="getDepositRedeemButtonClass('deposit')"
          variant="outlined"
          @click="selectActionButton('deposit')"
        >
          Deposit
          <v-tooltip activator="parent" location="bottom">
            Deposit tokens to the fund.
          </v-tooltip>
        </v-btn>
        <v-btn
          :class="getDepositRedeemButtonClass('redeem')"
          variant="outlined"
          @click="selectActionButton('redeem')"
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
        <FundSettlementDeposit
          v-if="isSelectedDepositButton"
          @deposit-success="openDelegateDialog"
        />
        <FundSettlementRedeem v-else-if="isSelectedRedeemButton" />
      </div>
    </div>

    <FundGovernanceModalDelegateVotes v-model="isDelegateDialogOpen" />
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

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
      selectedActionButtonValue: "deposit",
      isDelegateDialogOpen: false,
    };
  },
  computed: {
    isSelectedDepositButton() {
      return this.selectedActionButtonValue === "deposit";
    },
    isSelectedRedeemButton() {
      return this.selectedActionButtonValue === "redeem";
    },
  },
  methods: {
    selectActionButton(value: string) {
      this.selectedActionButtonValue = value;
    },
    getDepositRedeemButtonClass(buttonType: string) {
      // Check if this.selectedActionButtonValue is falsy and return "" if so
      if (!this.selectedActionButtonValue) return "";

      // Return "button-active" if buttonType matches this.selectedActionButtonValue,
      // otherwise return "button-inactive"
      return buttonType === this.selectedActionButtonValue
        ? "button-active"
        : "button-inactive";
    },
    openDelegateDialog() {
      console.log("openDelegateDialog");
      this.isDelegateDialogOpen = true;
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_settlement {
  overflow: auto;
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

    &__title{
      font-size: 1rem;
      font-weight: bold;
      color: $color-subtitle;
      line-height: 1;
      margin-bottom: 0.75rem;

      @include sm{
        margin-bottom: 0
      }
    }
  }
}
</style>
