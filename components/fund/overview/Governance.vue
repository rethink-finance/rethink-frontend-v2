<template>
  <div class="main_grid">
    <UiDataRowCard :title="fund.governorAddress" subtitle="Governance Contract" />
    <UiDataRowCard :title="fund.governanceToken?.address" subtitle="Governance Token" />
    <UiDataRowCard :title="fund.votingDelay" subtitle="Voting Delay (in seconds)" />
    <UiDataRowCard :title="fund.votingPeriod" subtitle="Voting Period (in seconds)" />
    <UiDataRowCard :title="fund.proposalThreshold" subtitle="Proposal Threshold" />
    <UiDataRowCard :title="fund.quorom" subtitle="Quorum" />
    <UiDataRowCard :title="fund.lateQuorom" subtitle="Late Quorum (in seconds)" />
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
})
</script>

<style lang="scss" scoped>
</style>
