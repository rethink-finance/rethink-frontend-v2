<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_governance"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading Activity"
    items-per-page="-1"
  >
    <template #[`header.approval`]="{ column }">
      <!-- HEADERS -->
      <div class="table_governance__header_cell justify-end">
        {{ column.title }}
        <span class="d-flex align-center ms-1">
          <Icon icon="octicon:question-16" width="1rem" />
        </span>
        <v-tooltip activator="parent" location="top">
          Calculated as: <br>
          <strong>votes for / total casted votes</strong><br>
        </v-tooltip>
      </div>
    </template>
    <template #[`header.participation`]="{ column }">
      <div class="table_governance__header_cell justify-end">
        {{ column.title }}
        <span class="d-flex align-center ms-1">
          <Icon icon="octicon:question-16" width="1rem" />
        </span>
        <v-tooltip activator="parent" location="top">
          Calculated as: <br>
          <strong>total votes / total supply</strong>
        </v-tooltip>
      </div>
    </template>

    <!-- BODY -->
    <template #item="{ item, index }">
      <tr :class="getRowClass(item)" @click="rowClick($event, item)">
        <td><strong>{{ index + 1 }}</strong></td>
        <td>
          <div class="proposal__title">
            <div class="proposal__title__text">
              <div>{{ item.title }}</div>
            </div>
            <div class="proposal__tags">
              <FundGovernanceProposalStateChip
                :value="item.state"
                class="proposal__tag"
              />
              <FundGovernanceProposalStateChip
                v-for="(calldataTag, index) of item.calldataTags ?? []"
                :key="index"
                :value="calldataTag"
                class="proposal__tag"
              />
            </div>
          </div>
        </td>
        <td>{{ item.createdDatetimeFormatted }}</td>
        <td v-if="accountStore.isConnected">
          <div class="table_governance__voted_cell">
            <div v-if="item.hasVotedLoading">
              <v-progress-circular
                indeterminate
                color="gray"
                size="16"
                width="2"
              />
            </div>
            <div v-else-if="governanceProposalStore.hasAccountVoted(item.proposalId) === undefined">
              N/A
            </div>
            <div v-else>
              <Icon
                v-if="governanceProposalStore.hasAccountVoted(item.proposalId)"
                icon="weui:done-filled"
                width="1rem"
                height="1rem"
                color="var(--color-success)"
              />
              <icon
                v-else
                icon="mingcute:close-fill"
                color="var(--color-error)"
              />
            </div>
          </div>
        </td>
        <td>
          <div class="d-flex justify-end">
            {{ item.approvalFormatted }}
            <v-tooltip activator="parent" location="bottom">
              {{ item.forVotesFormatted }} of {{ item.totalVotesFormatted }}
            </v-tooltip>
          </div>
        </td>
        <td>
          <div class="d-flex justify-end">
            {{ item.participationFormatted }}
            <v-tooltip activator="parent" location="bottom">
              {{ item.totalVotesFormatted }} of {{ item.totalSupplyFormatted }}
            </v-tooltip>
          </div>
        </td>
      </tr>
    </template>

    <!-- LOADER SKELETON -->
    <!-- Conditionally render the loading skeleton at the beginning or end -->
    <template v-if="loadingVariant === 'prepend'" #[`body.prepend`]>
      <tr v-if="items.length && loading">
        <td>1</td>
        <td v-for="header in headers.length - 1" :key="header">
          <v-skeleton-loader type="text" class="table_governance__skeleton_loader" />
        </td>
      </tr>
    </template>
    <template v-if="loadingVariant === 'append'" #[`body.append`]>
      <tr v-if="items.length && loading">
        <td>
          {{ items.length + 1 }}
        </td>
        <td v-for="header in headers.length - 1" :key="header">
          <v-skeleton-loader type="text" class="table_governance__skeleton_loader" />
        </td>
      </tr>
    </template>
    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="table_governance__no_data">
    No Governance Activity details available.
  </div>
</template>

<script setup lang="ts">
// types
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ProposalState } from "~/types/enums/governance_proposal";
import type IGovernanceProposal from "~/types/governance_proposal";

const router = useRouter();
const web3Store = useWeb3Store();
const fundStore = useFundStore();
const governanceProposalStore = useGovernanceProposalsStore();
const accountStore = useAccountStore();

// defined icons for submission_status
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};

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


const getRowClass = (item: IGovernanceProposal) => {
  const hasVoted = governanceProposalStore.hasAccountVoted(item?.proposalId) ?? false;
  const isActionRequired = item.state === ProposalState.Active && !hasVoted || item.state === ProposalState.Pending;

  return [
    "v-data-table__row",
    { "row-active": isActionRequired },
  ];
};

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

    // console.log("get votes for ", proposal.proposalId);
    proposal.hasVotedLoading = true;
    web3Store.callWithRetry(
      fundChainId, () =>
        fundStore.fundGovernorContract.methods.hasVoted(proposal.proposalId, activeAccountAddress).call(),
    ).then(
      (hasVoted: boolean) => {
        // console.log("has voted: ", proposal.proposalId, proposal.state, hasVoted)
        governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId][activeAccountAddress] = hasVoted;
      },
    ).finally(() => {
      proposal.hasVotedLoading = false;
    });
  }
},
{ immediate: true },
);

const headers = computed(() => {
  const headers: any[] = [
    { title: "#", key: "index", sortable: false },
    { title: "Proposal Title", key: "title", sortable: true },
    { title: "Created", key: "createdDatetime", sortable: true },
  ];
  if (accountStore.isConnected) {
    headers.push({ title: "Voted", key: "submission_status", sortable: true, align: "center" });
  }

  headers.push(...[
    { title: "Approval", key: "approval", sortable: true },
    {
      title: "Participation",
      key: "participation",
      sortable: true,
    },
  ]);

  return headers;
});

// navigate to proposal detail page
const rowClick = (_:any, item: any) => {
  const { createdBlockNumber, proposalId } = item;
  router.push(`governance/proposal/${createdBlockNumber}-${proposalId}`);
};
</script>

<style lang="scss" scoped>
.table_governance {

  @include borderGray;
  border-color: $color-bg-transparent;
  // add table max height
  :deep(.v-table__wrapper) {
    max-height: 500px;

    @include customScrollbar;
  }
  .v-data-table__row {
    cursor: pointer;
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
    color: $color-steel-blue;

    &.row-active {
      background-color: $color-navy-gray-light;
      color: $color-white;
    }

    &:hover {
      background-color: $color-gray-light-transparent;
      box-shadow: 0px 0px 10px 0px #1f5fff29;
    }
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }

  &__skeleton_loader :deep(*) {
    margin: 0;
  }

  &__header_cell{
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__voted_cell {
    display: flex;
    justify-content: center;
    align-items: center;
    // move the voted cell because of the icon in the header
    margin-right: 21px;
  }
}

.proposal {
  &__title {
    padding-block: 0.5rem;
  }
  &__title__text {
    max-width: 400px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-wrap: break-word;
  }
  &__tags {
    display: flex;
    align-items: center;
    margin-top: 0.5rem;
  }
  &__tag {
    margin-right: 0.5rem;
  }
}

</style>
