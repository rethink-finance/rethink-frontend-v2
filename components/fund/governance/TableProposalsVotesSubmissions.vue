<template>
  <v-data-table
    v-if="items.length || loading"
    class="table-votes-submissions main_table"
    :headers="headers"
    hover
    :items="items"
    :loading="loading && items.length === 0"
    loading-text="Loading Activity"
  >
    <!-- BODY -->
    <template #[`item.proposer`]="{ item }">
      {{ truncateAddress(item.proposer) }}
    </template>
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

    <!-- LOADER SKELETON -->
    <template #[`body.append`]>
      <tr v-if="items.length && loading">
        <td>
          {{ items.length + 1 }}
        </td>
        <td v-for="header in headers.length - 1" :key="header">
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
    No Proposals Votes Submissions
  </div>
</template>

<script setup lang="ts">
// types
import { truncateAddress } from "~/composables/addressUtils";
import { useAccountStore } from "~/store/account.store";
import type IGovernanceProposal from "~/types/governance_proposal";

const accountStore = useAccountStore();

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
    type: Array as () => Partial<IGovernanceProposal>[],
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
  if (accountStore.isConnected) {
    headers.push({
      title: "Submission",
      key: "submission_status",
      sortable: true,
    });
  }
  headers.push({
    title: "Voting Power",
    key: "requiredVotes",
    sortable: true,
    align: "end",
  });

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

.submission_status {
  display: flex;
  align-items: center;
  color: $color-steel-blue;

  &__text {
    margin-left: 0.5rem;
  }
}
</style>
