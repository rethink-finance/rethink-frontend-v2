<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_governance main_table"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading Activity"
    @click:row="(item: any) => $router.push(`governance/proposal/${item.proposalId}`)"
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
            value="Permissions"
            class="proposal__tag"
          />
        </div>
      </div>
    </template>
    <!-- TODO display this only if wallet connected -->
    <template #[`item.submission_status`]="{ item }">
      <div class="submission_status">
        <Icon
          :icon="icons[item.submission_status as keyof typeof icons]"
          width="1.4rem"
          class="submission_status__icon"
        />
        <div class="submission_status__text">
          {{ item.submission_status }}
        </div>
      </div>
    </template>
    <template #[`item.approval`]="{ item }">
      {{ item.approvalFormatted }}
      <v-tooltip activator="parent" location="bottom">
        {{ item.forVotesFormatted }} of {{ item.quorumFormatted }} {{ fund?.governanceToken.symbol }}
      </v-tooltip>
    </template>
    <template #[`item.participation`]="{ item }">
      {{ item.participationFormatted }}
      <v-tooltip activator="parent" location="bottom">
        {{ item.totalVotesFormatted }} of {{ item.totalSupplyFormatted }} {{ fund?.governanceToken.symbol }}
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
import type IGovernanceProposal from "~/types/governance_proposal";

const fundStore = useFundStore();
const accountStore = useAccountStore();
const { fund } = toRefs(fundStore);

// defined icons for submission_status
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};

defineProps({
  items: {
    type: Array as () => IGovernanceProposal[],
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const headers = computed(() => {
  const headers: any[] = [
    { title: "#", key: "index", sortable: false },
    { title: "Proposal Title", key: "title", sortable: true },
  ];
  if (accountStore.isConnected) {
    headers.push({ title: "Submission", key: "submission_status", sortable: true });
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
