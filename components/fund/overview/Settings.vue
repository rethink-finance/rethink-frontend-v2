<template>
  <!-- Fees and contract addresses graduated to their own cards on the
       overview, so the accordion only keeps what has no card of its own. -->
  <div class="accordion_content">
    <section class="accordion_content__section">
      <div class="accordion_content__title">
        Whitelist
      </div>
      <FundOverviewDeposits :fund="fund" class="whitelist_card" />
    </section>
    <section class="accordion_content__section">
      <div class="accordion_content__title">
        Management
      </div>
      <FundOverviewManagement :fund="fund" />
    </section>
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
          this.fund.governanceToken.decimals,
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
/* Sections sit flat inside the Vault settings card — nesting cards inside a
   card is what the design specifically avoids. */
.accordion_content {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;

  :deep(.v-expansion-panel-title) {
    padding: 0.625rem 0.5rem !important;
    font-size: $text-sm !important;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  &__title {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-cyan;
  }
}
.whitelist_card {
  :deep(.v-expansion-panel-text__wrapper) {
    padding: 0.625rem 0.5rem !important;
  }
}
</style>
