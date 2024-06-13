<template>
  <v-data-table
    v-if="methods.length"
    :headers="headers"
    :items="methods"
    @click:row="rowClick"
    class="main_table nav_entries"
  >
    <template #[`item.index`]="{ index }">
      <strong>{{ index + 1 }}</strong>
    </template>
    <template #[`item.title`]="{ item }">
      <div class="pt-2 pb-2">
        <div>
          {{ item.title }}
        </div>
        <div class="d-flex align-center mt-2">
          <UiChip
            v-for="tag in item.tags"
            :key="tag"
            :value="tag"
            class="me-2"
          />
        </div>
      </div>
    </template>
    <template #[`item.submission`]="{ item }">
      <div class="d-flex align-center">
        <Icon
          :icon="icons[item.submission as keyof typeof icons]"
          width="1.4rem"
        />

        <div class="ms-1">
          {{ item.submission }}
        </div>
      </div>
    </template>
    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else class="nav_entries__no_data">
    No Governance Activity details available.
  </div>
</template>

<script lang="ts">
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
  name: "GovernanceTable",
  props: {
    methods: {
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
    rowClick(index: any, item: GOVActivity) {
      console.log("Row clicked", item);
    },
  },
});
</script>

<style lang="scss" scoped>
.nav_entries {
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }
}
</style>
