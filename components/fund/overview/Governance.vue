<template>
  <div class="main_grid">
    <UiDataRowCard :title="fund.governorAddress" subtitle="Governance Contract" />
    <UiDataRowCard :title="fund.governanceToken?.address" subtitle="Governance Token" />
    <UiDataRowCard :title="fund.votingDelay" subtitle="Voting Delay" />
    <UiDataRowCard :title="fund.votingPeriod" subtitle="Voting Period" />
    <UiDataRowCard :title="fund.proposalThreshold" subtitle="Proposal Threshold" />
    <UiDataRowCard :title="quorumFormatted" subtitle="Quorum" />
    <UiDataRowCard :title="fund.lateQuorum" subtitle="Late Quorum" />
    <UiDataRowCard :title="governanceTokenTotalSupplyFormatted" subtitle="Governance Token Total Supply" />
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
      return formatTokenValue(
        this.fund.governanceTokenTotalSupply,
        this.fund.governanceToken.decimals) + " " + this.fund.governanceToken.symbol;
    },
    quorumFormatted() {
      return `${this.fund.quorumPercentage} (${this.fund.quorumVotesFormatted} ${this.fund.governanceToken.symbol})`
    },
  },
})
</script>

<style lang="scss" scoped>
</style>
