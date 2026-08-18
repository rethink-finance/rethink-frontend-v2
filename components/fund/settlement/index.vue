<template>
  <div class="fund_settlement brand_card">
    <!-- The Deposit/Redeem switch IS the card's title: full width, its labels
         set like section eyebrows. -->
    <UiButtonSwitchItems
      v-model="selectedActionButtonValue"
      :items="selectItems"
      class="fund_settlement__buttons"
      @update:model-value="selectActionButton"
    />
    <div class="fund_settlement__card_boxes">
      <div v-if="selectedActionButtonValue">
        <!-- The settlement cycle is handed to the form rather than drawn after
             it, so it lands between the amount and the button that commits it.
             Both forms take it in the same place, so switching tabs does not
             move it. -->
        <FundSettlementDeposit
          v-if="isSelectedDepositButton"
        >
          <template #before-actions>
            <FundSettlementCycle :period="plannedSettlement" />
          </template>
        </FundSettlementDeposit>
        <!-- @deposit-success="openDelegateDialog" -->
        <FundSettlementRedeem v-else-if="isSelectedRedeemButton">
          <template #before-actions>
            <FundSettlementCycle :period="plannedSettlement" />
          </template>
        </FundSettlementRedeem>
      </div>
    </div>

    <FundGovernanceModalDelegateVotes v-model="isDelegateDialogOpen" />
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";
import { parsePlannedSettlement } from "~/composables/fund/parsePlannedSettlement";

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
      plannedSettlement: "",
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
  watch: {
    // Design footnotes the form with the planned settlement cycle, so a
    // depositor knows when the request they are about to submit will settle.
    "fund.address": {
      immediate: true,
      async handler() {
        if (!this.fund?.chainId || !this.fund?.plannedSettlementPeriod) {
          this.plannedSettlement = "";
          return;
        }
        try {
          const parsed = await parsePlannedSettlement(
            this.fund.chainId,
            this.fund.plannedSettlementPeriod,
          );
          this.plannedSettlement = parsed ?? "";
        } catch {
          this.plannedSettlement = "";
        }
      },
    },
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
  padding: 1.625rem 1.875rem;

  /* Design draws this as one segmented control — a hairline pill split down
     the middle — rather than the app's usual spaced tab group. Scoped here so
     the shared switch keeps its own look everywhere else it is used. */
  &__buttons {
    width: 100%;
    margin-bottom: 1.125rem;
    padding: 0;
    gap: 0;
    background-color: transparent;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    overflow: hidden;

    :deep(.v-btn) {
      min-width: 0;
      height: auto;
      padding: 0.625rem 1rem;
      border-radius: 0;
      font-family: $font-mono;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;

      + .v-btn {
        border-left: 1px solid $color-line-2;
      }

      &.active {
        background-color: $color-navy-gray-light;
      }
    }
  }

  &__card_boxes {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

}
</style>
