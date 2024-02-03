<template>
  <div class="main_grid">
    <UiDataRowCard :title="fund.governor_address" subtitle="Governance Contract" />
    <UiDataRowCard :title="fund.governor_token.address" subtitle="Governance Token" />
    <UiDataRowCard :title="fund.voting_delay" subtitle="Voting Delay (in seconds)" />
    <UiDataRowCard :title="fund.voting_period" subtitle="Voting Period (in seconds)" />
    <UiDataRowCard :title="fund.proposal_threshold" subtitle="Proposal Threshold" />
    <UiDataRowCard :title="fund.quorom" subtitle="Quorum" />
    <UiDataRowCard :title="fund.late_quorom" subtitle="Late Quorum (in seconds)" />
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
