<template>
  <div class="fund_details">
    <FundInfoDescription :fund="fund" />

    <FundInfoInsights :fund="fund" />

    <FundChart :fund="fund" />

    <FundInfoComposition :fund="fund" />

    <FundInfoMonthlyReturns :fund="fund" />

    <!-- Shown on every chain: settlements come from chain data, so the card is
         still useful where the subgraph is missing or lagging. -->
    <FundActivity :fund="fund" />

    <FundInfoGovernance :fund="fund" />

    <FundInfoFees :fund="fund" />

    <FundInfoContracts :fund="fund" />
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";

const fund = useAttrs().fund as IFund;
</script>

<style scoped lang="scss">
/**
 * The vault's own story. The deposit rail that sits beside this column is
 * rendered by the page shell (details/[fundSlug].vue) instead of here, so it
 * can start level with the vault title and stay pinned while this scrolls.
 */
.fund_details {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  min-width: 0;
}
</style>
