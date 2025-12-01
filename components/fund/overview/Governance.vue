<template>
  <div class="main_grid accordion_content">
    <UiDataRowCard subtitle="Governance Contract">
      <template #title>
        <AddressLink :address="fund.governorAddress" :chain-id="fund.chainId" />
      </template>
    </UiDataRowCard>
    <UiDataRowCard subtitle="Governance Token">
      <template #title>
        <AddressLink :address="fund.governanceToken?.address" :chain-id="fund.chainId" />
      </template>
    </UiDataRowCard>
    <UiDataRowCard :title="fund.votingDelay" subtitle="Voting Delay" />
    <UiDataRowCard :title="fund.votingPeriod" subtitle="Voting Period" />
    <UiDataRowCard :title="fund.proposalThreshold" subtitle="Proposal Threshold" />
    <UiDataRowCard :title="quorumFormatted" subtitle="Quorum" />
    <UiDataRowCard :title="fund.lateQuorum" subtitle="Late Quorum" />
    <UiDataRowCard :title="governanceTokenTotalSupplyFormatted" subtitle="Governance Token Total Supply" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type IFund from "~/types/fund";
import AddressLink from "~/components/common/AddressLink.vue";
import { formatTokenValue } from "~/composables/formatters";

const props = defineProps({
  fund: {
    type: Object as PropType<IFund>,
    default: () => ({}),
  },
});

const governanceTokenTotalSupplyFormatted = computed(() => {
  return formatTokenValue(
    props.fund.governanceTokenTotalSupply,
    props.fund.governanceToken.decimals,
  ) + " " + props.fund.governanceToken.symbol;
});

const quorumFormatted = computed(() => {
  return `${props.fund.quorumPercentage} (${props.fund.quorumVotesFormatted} ${props.fund.governanceToken.symbol})`;
});
</script>

<style lang="scss" scoped>
.accordion_content{
  :deep(.v-expansion-panel-title) {
    padding: 0.625rem 0.5rem !important;
    font-size: $text-sm !important;
  }
}
</style>
