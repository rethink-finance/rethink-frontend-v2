<template>
  <div class="proposals_table">
    <div class="proposals_table__scroll">
      <div class="proposals_table__grid">
        <div class="proposals_table__row proposals_table__row--head">
          <div class="proposals_table__th">
            #
          </div>
          <div class="proposals_table__th">
            Proposal
          </div>
          <div class="proposals_table__th">
            Created
          </div>
          <div class="proposals_table__th proposals_table__th--center">
            Voted
          </div>
          <div
            class="proposals_table__th proposals_table__th--right"
            title="Votes for / total cast votes"
          >
            Approval
          </div>
          <div
            class="proposals_table__th proposals_table__th--right"
            title="Total votes / total supply"
          >
            Participation
          </div>
        </div>

        <div
          v-if="loading && loadingVariant === 'prepend'"
          class="proposals_table__row proposals_table__row--skeleton"
        >
          <div v-for="cell in 6" :key="cell">
            <v-skeleton-loader type="text" class="proposals_table__skeleton" />
          </div>
        </div>

        <div
          v-for="(item, index) in items"
          :key="item.proposalId"
          class="proposals_table__row proposals_table__row--clickable"
          @click="rowClick(item)"
        >
          <div class="proposals_table__index">
            {{ String(index + 1).padStart(2, "0") }}
          </div>

          <div class="proposals_table__proposal">
            <div class="proposals_table__title">
              {{ item.title }}
            </div>
            <div class="proposals_table__badges">
              <FundGovernanceStateBadge :value="item.state" />
              <FundGovernanceStateBadge
                v-for="(calldataTag, tagIndex) of item.calldataTags ?? []"
                :key="tagIndex"
                :value="calldataTag"
                neutral
              />
            </div>
          </div>

          <div class="proposals_table__created">
            {{ item.createdDatetimeFormatted }}
          </div>

          <div class="proposals_table__voted">
            <v-progress-circular
              v-if="item.hasVotedLoading"
              size="14"
              width="2"
              indeterminate
            />
            <span
              v-else-if="hasVoted(item)"
              class="proposals_table__voted_yes"
            >✓</span>
            <span v-else class="proposals_table__voted_no">✗</span>
          </div>

          <div
            class="proposals_table__number"
            :title="`${item.forVotesFormatted} of ${item.totalVotesFormatted}`"
          >
            {{ approvalOf(item) }}
          </div>

          <div
            class="proposals_table__number"
            :title="`${item.totalVotesFormatted} of ${item.totalSupplyFormatted}`"
          >
            {{ participationOf(item) }}
          </div>
        </div>

        <div
          v-if="loading && loadingVariant === 'append'"
          class="proposals_table__row proposals_table__row--skeleton"
        >
          <div v-for="cell in 6" :key="cell">
            <v-skeleton-loader type="text" class="proposals_table__skeleton" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!items.length && !loading" class="proposals_table__empty">
      No governance activity yet.
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type IGovernanceProposal from "~/types/governance_proposal";

const router = useRouter();
const web3Store = useWeb3Store();
const fundStore = useFundStore();
const governanceProposalStore = useGovernanceProposalsStore();

const props = defineProps({
  items: {
    type: Array as () => IGovernanceProposal[],
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadingVariant: {
    type: String,
    default: "append", // append, prepend
  },
});

const hasVoted = (item: IGovernanceProposal) =>
  governanceProposalStore.hasAccountVoted(item.proposalId) ?? false;

/**
 * Two decimals in the table, where the figures are read against each other,
 * and a dash rather than 0.00% where no vote has been cast at all — a proposal
 * nobody voted on has no approval rate, which is not the same as zero approval.
 */
const asPercent = (value?: number) =>
  value === undefined || value === null || Number.isNaN(value)
    ? "—"
    : `${(value * 100).toFixed(2)}%`;

const approvalOf = (item: IGovernanceProposal) =>
  item.totalVotes ? asPercent(item.approval) : "—";

const participationOf = (item: IGovernanceProposal) =>
  asPercent(item.participation);

watch([() => props.items, () => fundStore.activeAccountAddress], () => {
  if (fundStore.activeAccountAddress === undefined) {
    return
  }
  const activeAccountAddress = fundStore.activeAccountAddress;
  const fundChainId = fundStore.selectedFundChain;

  for (const proposal of props.items) {
    governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId] ??= {};
    // Do not fetch the hasVoted again if we already know he has voted.
    if (governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId][activeAccountAddress]) continue;

    proposal.hasVotedLoading = true;
    web3Store.callWithRetry(
      fundChainId, () =>
        fundStore.fundGovernorContract.methods.hasVoted(proposal.proposalId, activeAccountAddress).call(),
    ).then(
      (hasVoted: boolean) => {
        governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId][activeAccountAddress] = hasVoted;
      },
    ).finally(() => {
      proposal.hasVotedLoading = false;
    });
  }
},
{ immediate: true },
);

// navigate to proposal detail page
const rowClick = (item: IGovernanceProposal) => {
  const { createdBlockNumber, proposalId } = item;
  router.push(`governance/proposal/${createdBlockNumber}-${proposalId}`);
};
</script>

<style lang="scss" scoped>
/**
 * A grid rather than a table: the proposal cell stacks a title over a wrapping
 * row of badges, which a table cell can do but not while keeping every other
 * column aligned to the same tracks.
 */
.proposals_table {
  &__scroll {
    overflow-x: auto;
  }

  &__grid {
    min-width: 920px;
  }

  &__row {
    display: grid;
    grid-template-columns: 44px 1.9fr 130px 80px 110px 130px;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1.5rem;
    border-bottom: 1px solid $color-line;

    &--head {
      height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      border-top: 1px solid $color-line;
    }

    &--clickable {
      cursor: pointer;
      transition: background-color 0.2s ease;

      &:hover {
        background: $color-navy-gray-light;
      }
    }
  }

  &__th {
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--right {
      text-align: right;
    }

    &--center {
      text-align: center;
    }
  }

  &__index {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }

  &__proposal {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__title {
    font-size: 13.5px;
    font-weight: 600;
    color: $color-white;
    overflow-wrap: anywhere;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  &__created {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-text-irrelevant;
  }

  &__voted {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: $font-mono;
    font-size: 13px;
  }

  &__voted_yes {
    color: $color-cyan;
  }

  &__voted_no {
    color: $color-steel-blue;
  }

  &__number {
    font-family: $font-mono;
    font-size: 12.5px;
    text-align: right;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__skeleton :deep(*) {
    margin: 0;
  }

  &__empty {
    padding: 1.5rem;
    text-align: center;
    font-size: $text-sm;
    color: $color-steel-blue;
  }
}
</style>
