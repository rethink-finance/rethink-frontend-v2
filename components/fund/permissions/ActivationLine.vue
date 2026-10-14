<template>
  <NuxtLink class="activation_line" :to="proposal ? proposalLink(proposal) : to">
    <Icon :icon="icon" width="0.9375rem" />
    <span>{{ proposal ? "Activation proposal pending" : text }}</span>
    <span class="activation_line__dot">·</span>
    <span>{{ proposal ? activationProposalStatus(proposal.state) : action }}</span>
    <Icon
      class="activation_line__chevron"
      icon="material-symbols:chevron-right-rounded"
      width="1rem"
    />
  </NuxtLink>
</template>

<script setup lang="ts">
import { activationProposalStatus } from "~/composables/permissions/pendingActivationProposal";
import { useFundStore } from "~/store/fund/fund.store";
import type IGovernanceProposal from "~/types/governance_proposal";

/**
 * One quiet line about a vault's activation: the live proposal that does it
 * and where it stands, or what is still missing and where to fix it.
 */
const props = defineProps<{
  proposal?: IGovernanceProposal | null;
  /** Without a proposal: what is missing, what to do, and where. */
  text?: string;
  action?: string;
  to?: string;
}>();

const { selectedFundSlug } = storeToRefs(useFundStore());

const icon = computed(() =>
  props.proposal
    ? "material-symbols:schedule-outline-rounded"
    : "material-symbols:info-outline-rounded",
);

const proposalLink = (proposal: IGovernanceProposal) =>
  `/details/${selectedFundSlug.value}/governance/proposal/` +
  `${proposal.createdBlockNumber}-${proposal.proposalId}`;
</script>

<style scoped lang="scss">
.activation_line {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 12px;
  color: $color-steel-blue;
  text-decoration: none;
  transition: color 0.15s ease;

  &__dot,
  &__chevron {
    opacity: 0.6;
  }

  &:hover {
    color: $color-white;
  }
}
</style>
