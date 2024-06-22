<template>
  <v-data-table
    v-if="items.length || loading"
    class="table_governance main_table"
    :headers="headers"
    hover
    :items="items"
    :loading="loading"
    loading-text="Loading Activity"
    @click:row="rowClick"
  >
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
    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="table_governance__no_data">
    No Governance Activity details available.
  </div>
</template>

<script lang="ts">
// types
import type IGovernanceProposal from "~/types/governance_proposal";

// defined icons for submission_status
const icons = {
  Pending: "material-symbols:timer-outline",
  Missed: "material-symbols:priority-high",
  Abstained: "material-symbols:question-mark",
  Rejected: "material-symbols:close",
  Approved: "material-symbols:done",
};


export default defineComponent({
  name: "TableGovernance",
  props: {
    items: {
      type: Array as () => IGovernanceProposal[],
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    expanded: [],
    // bug fix for vuetify table headers property 'align'
    // https://github.com/vuetifyjs/vuetify/issues/18901
    headers: ref([
      { title: "#", key: "index", sortable: false },
      { title: "Proposal Title", key: "title", sortable: true },
      { title: "Submission", key: "submission_status", sortable: true },
      { title: "Approval", key: "approval", sortable: true, align: "center" },
      {
        title: "Participation",
        key: "participation",
        sortable: true,
        align: "center",
      },
    ] as const),
    icons,
  }),
  methods: {
    // change route depending on row id (proposal ID)
    rowClick(index: any, item: any) {
      const { item: clickedItem } = item;

      this.$router.push(`governance/proposal/${clickedItem.id}`);
    },
  },
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
