<template>
  <v-data-table
    v-if="items.length"
    class="table-governance main_table"
    :headers="headers"
    hover
    :items="items"
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
          <UiChip
            v-for="tag in item.tags"
            :key="tag"
            :value="tag"
            class="proposal__tag"
          />
        </div>
      </div>
    </template>
    <template #[`item.submission`]="{ item }">
      <div class="submission">
        <Icon
          :icon="icons[item.submission as keyof typeof icons]"
          width="1.4rem"
          class="submission__icon"
        />
        <div class="submission__text">
          {{ item.submission }}
        </div>
      </div>
    </template>
    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="table-governance__no_data">
    No Governance Activity details available.
  </div>
</template>

<script lang="ts">
// types
import type GOVActivity from "~/types/governance_activity";

// defined icons for submission
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
      type: Array as () => GOVActivity[],
      default: () => [],
    },
  },
  data: () => ({
    expanded: [],
    // bug fix for vuetify table headers property 'align'
    // https://github.com/vuetifyjs/vuetify/issues/18901
    headers: ref([
      { title: "#", key: "index", sortable: false },
      { title: "Proposal Title", key: "title", sortable: true },
      { title: "Submission", key: "submission", sortable: true },
      { title: "Approval", key: "approval", sortable: true, align: "center" },
      {
        title: "Participation",
        key: "participation",
        sortable: true,
        align: "center",
      },
    ] as const),
    icons: icons,
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
.table-governance {
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

.submission {
  display: flex;
  align-items: center;

  &__text {
    margin-left: 0.5rem;
  }
}
</style>
