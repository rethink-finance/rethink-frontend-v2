<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_governance main_table"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading Activity"
    @click:row="rowClick"
  >
    <template #[`header.approval`]="{ column }">
      <!-- HEADERS -->
      <div class="d-flex justify-center">
        {{ column.title }}
        <span class="d-flex align-center ms-1">
          <Icon icon="octicon:question-16" width="1rem" />
        </span>
        <v-tooltip activator="parent" location="top">
          Calculated as: <br>
          <strong>votes for / required quorum votes</strong><br>
        </v-tooltip>
      </div>
    </template>
    <template #[`header.participation`]="{ column }">
      <div class="d-flex justify-center">
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
    <template #[`item.index`]="{ index }">
      <strong>{{ index + 1 }}</strong>
    </template>
    <template #[`item.title`]="{ item }">
      <div class="proposal__title">
        <div>
          {{ item.title }}
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
    </template>
    <template #[`item.createdDatetime`]="{ item }">
      {{ item.createdDatetimeFormatted }}
    </template>

    <template #[`item.submission_status`]="{ item }">
      <template
        v-if="governanceProposalStore.hasAccountVoted(item.proposalId) === undefined"
      >
        N/A
      </template>
      <template v-else>
        <Icon
          v-if="governanceProposalStore.hasAccountVoted(item.proposalId)"
          icon="octicon:check-circle-fill-16"
          width="1rem"
          height="1rem"
          color="var(--color-success)"
        />
        <icon
          v-else
          icon="octicon:x-circle-fill-16"
          color="var(--color-error)"
        />
      </template>
    </template>
    <template #[`item.approval`]="{ item }">
      {{ item.approvalFormatted }}
      <v-tooltip activator="parent" location="bottom">
        {{ item.forVotesFormatted }} of {{ item.quorumVotesFormatted }}
      </v-tooltip>
    </template>
    <template #[`item.participation`]="{ item }">
      {{ item.participationFormatted }}
      <v-tooltip activator="parent" location="bottom">
        {{ item.totalVotesFormatted }} of {{ item.totalSupplyFormatted }}
      </v-tooltip>
    </template>

    <!-- LOADER SKELETON -->
    <template #[`body.append`]>
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
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useGovernanceProposalsStore } from "~/store/governance_proposals.store";
import type IGovernanceProposal from "~/types/governance_proposal";

const router = useRouter();
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
});


// TODO to fetch status of all votes of all users we again have to iterate over all events and check VoteCast event
watch(() => props.items, () => {
  console.log("props items watcher", props.items);
  if (fundStore.activeAccountAddress === undefined) {
    return
  }
  const activeAccountAddress = fundStore.activeAccountAddress;

  for (const proposal of props.items) {
    governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId] ??= {};
    // Do not fetch the hasVoted again if we already know he has voted.
    if (governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId][activeAccountAddress]) continue;

    console.log("get votes for ", proposal.proposalId);
    fundStore.fundGovernorContract.methods.hasVoted(proposal.proposalId, activeAccountAddress).call().then(
      (hasVoted: boolean) => {
        console.log("has voted: ", proposal.proposalId, proposal.state, hasVoted)
        governanceProposalStore.connectedAccountProposalsHasVoted[proposal.proposalId][activeAccountAddress] = hasVoted;
      },
    );
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
    headers.push({ title: "Has Voted", key: "submission_status", sortable: true, align: "center" });
  }

  headers.push(...[
    { title: "Approval", key: "approval", sortable: true, align: "center" },
    {
      title: "Participation",
      key: "participation",
      sortable: true,
      align: "center",
    },
  ]);

  return headers;
});

// navigate to proposal detail page
const rowClick = (_:any, item: any) => {
  const {createdBlockNumber, proposalId} = item.item;
  router.push(`governance/proposal/${createdBlockNumber}-${proposalId}`);
};
</script>

<style lang="scss" scoped>
.table_governance {
  // add table max height
  :deep(.v-table__wrapper) {
    max-height: 500px;
  }
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }

  &__skeleton_loader :deep(*) {
    margin: 0;
  }
}

.proposal {
  &__title {
    padding-block: 0.5rem;
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

.submission_status {
  display: flex;
  align-items: center;

  &__text {
    margin-left: 0.5rem;
  }
}
</style>
