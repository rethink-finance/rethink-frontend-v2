<template>
  <v-data-table
    v-if="items.length || loading"
    class="table-votes-submissions main_table"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading Votes"
    items-per-page="-1"
  >
    <!-- BODY -->
    <template #[`item.proposer`]="{ item }">
      <div class="members_wallet">
        {{ truncateAddress(item.proposer) }}
        <FundGovernanceProposalStateChip
          v-if="item.my_vote"
          value="This is you"
        />
      </div>
    </template>
    <template #[`item.submission_status`]="{ item }">
      <div class="submission_status">
        <Icon
          :icon="VoteTypeIcon[item.submission_status as VoteType]"
          width="1.4rem"
          :class="`icon--${VoteTypeClass[item.submission_status as VoteType]}`"
        />
        <div class="submission_status__text">
          {{ item.submission_status }}
        </div>
      </div>
    </template>

    <!-- LOADER SKELETON -->
    <template #[`body.append`]>
      <tr v-if="items.length && loading">
        <td v-for="header in headers" :key="header">
          <v-skeleton-loader
            type="text"
            class="table-votes-submissions__skeleton_loader"
          />
        </td>
      </tr>
    </template>
    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="table-votes-submissions__no_data">
    No Proposal Vote Submissions
  </div>
</template>

<script setup lang="ts">
// types
import { truncateAddress } from "~/composables/addressUtils";
import { VoteType, VoteTypeClass, VoteTypeIcon } from "~/types/enums/governance_proposal";
import type IProposalVoteSubmission from "~/types/vote_submission";

defineProps({
  items: {
    type: Array as () => IProposalVoteSubmission[],
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const headers = computed(() => {
  const headers: any[] = [
    { title: "Members Wallet", key: "proposer", sortable: true },
  ];
  headers.push({
    title: "Date",
    key: "date",
    sortable: true,
  })
  headers.push({
    title: "Submission",
    key: "submission_status",
    sortable: true,
  });
  headers.push({
    title: "Voting Power",
    key: "quorumVotes",
    sortable: true,
    align: "end",
  })

  return headers;
});
</script>

<style lang="scss" scoped>
.table-votes-submissions {
  background-color: unset;

  :deep(.v-table__wrapper) {
    max-height: 500px;
  }
  :deep(.v-table__wrapper thead) {
    background-color: $color-midnight-blue;
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

.members_wallet {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.submission_status {
  display: flex;
  align-items: center;
  color: $color-steel-blue;

  &__text {
    margin-left: 0.5rem;
  }
}
.icon{
  &--abstain {
    color: $color-warning;
  }
  &--against {
    color: $color-error;
  }
  &--for {
    color: $color-success;
  }
}
</style>
