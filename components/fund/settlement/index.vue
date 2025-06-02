<template>
  <div class="fund_settlement">
    <div class="card_header">
      <div class="card_header__title subtitle_white">
        Manage Deposits
      </div>
      <UiButtonSwitchItems
        v-model="selectedActionButtonValue"
        :items="selectItems"
        class="fund_settlement__buttons"
        @update:model-value="selectActionButton"
      />
    </div>
    <div class="fund_settlement__card_boxes">
      <div v-if="selectedActionButtonValue" class="card_box">
        <FundSettlementDeposit
          v-if="isSelectedDepositButton"
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
    shouldUserDelegate: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      selectedActionButtonValue: "deposit",
      isDelegateDialogOpen: false,
      selectItems: [
        {
          key: "deposit",
          label: "Deposit",
        },
        {
          key: "redeem",
          label: "Redeem",
        },
      ],
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
    openDelegateDialog() {
      console.log("openDelegateDialog");
      console.log("this.shouldUserDelegate: ", this.shouldUserDelegate);

      // only open the dialog if shouldUserDelegate is true
      if (this.shouldUserDelegate) {
        this.isDelegateDialogOpen = true;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.fund_settlement {
  overflow: auto;
  &__buttons {
    width: 100%;

    @include lg {
      width: 80%;
      margin-right: 5px;
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

    @include lg {
      flex-direction: row;
    }
    &__title {
      margin-bottom: 0.75rem;
      white-space: nowrap;
      width: fit-content;

      @include lg {
        margin-bottom: 0;
      }
    }
  }
}
</style>
