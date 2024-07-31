<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div>
        <div class="section_title">
          {{ fund?.plannedSettlementPeriod || "N/A" }}
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
        <FundSettlementDeposit
          v-if="isSelectedDepositButton"
          @deposit-success="openDelegateDialog"
        />
        <FundSettlementRedeem v-else-if="isSelectedRedeemButton" />
      </div>
      <div class="card_box card_box--no-padding">
        <FundSettlementNotification />
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
      selectedActionButtonValue: "",
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
    toggleActionButton(value: string) {
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
  }
}
</style>
