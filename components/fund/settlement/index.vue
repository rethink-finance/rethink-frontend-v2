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
          class="text-secondary"
          variant="outlined"
        >
          Deposit
          <v-tooltip activator="parent" location="bottom">
            Deposit tokens to the fund.
          </v-tooltip>
        </v-btn>
        <v-btn
          class="text-secondary"
          variant="outlined"
        >
          Redeem
          <v-tooltip activator="parent" location="bottom">
            Redeem tokens from the fund.
          </v-tooltip>
        </v-btn>
      </div>
    </div>
    <div>
      <div class="card_box">
        <FundSettlementDepositRedeemNotification />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
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
    return {};
  },
  computed: {
    formatAddress() {
      return truncateAddress(this.fund?.address);
    },
  },
  methods: {
    toggleGovernor() {
      return 1
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
}
</style>
