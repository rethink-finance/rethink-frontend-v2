<template>
  <div class="accordion_content">
    <div class="main_card">
      <div class="subtitle_steel_blue">Basics</div>
      <FundOverviewBasics :fund="fund" />
    </div>
    <div class="main_card">
      <div class="subtitle_steel_blue">Whitelist</div>
      <FundOverviewDeposits :fund="fund" class="whitelist_card" />
    </div>
    <div class="main_card">
      <div class="subtitle_steel_blue">Management</div>
      <FundOverviewManagement :fund="fund" />
    </div>
    <div class="main_card">
      <div class="subtitle_steel_blue">Fees</div>
      <FundOverviewFees :fund="fund" />
    </div>
  </div>
</template>

<script lang="ts">
import type IFund from "~/types/fund";

export default defineComponent({
  name: "Governance",
  props: {
    fund: {
      type: Object as PropType<IFund>,
      default: () => {},
    },
  },
  computed: {
    governanceTokenTotalSupplyFormatted() {
      return (
        formatTokenValue(
          this.fund.governanceTokenTotalSupply,
          this.fund.governanceToken.decimals
        ) +
        " " +
        this.fund.governanceToken.symbol
      );
    },
    quorumFormatted() {
      return `${this.fund.quorumPercentage} (${this.fund.quorumVotesFormatted} ${this.fund.governanceToken.symbol})`;
    },
  },
});
</script>

<style lang="scss" scoped>
.accordion_content {
  :deep(.v-expansion-panel-title) {
    padding: 10px 8px !important;
    font-size: 14px !important;
  }
}
.whitelist_card {
  :deep(.v-expansion-panel-text__wrapper) {
    padding: 10px 8px !important;
  }
}
</style>
