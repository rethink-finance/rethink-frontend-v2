<template>
  <v-data-table
    v-if="methods.length"
    :expanded="expanded"
    :headers="headers"
    :items="methods"
    class="main_table nav_entries"
  >
    <template #[`item.index`]="{ index }">
      <strong>{{ index + 1 }}</strong>
    </template>
    <template #[`item.title`]="{ value }">
      <div>
        <div>
          {{ value }}
        </div>
        <StateLabel value="liquid" />
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
    headers: [
      { title: "#", key: "index", sortable: false },
      { title: "Proposal Title", key: "title", sortable: false },
      { title: "Submission", key: "submission", sortable: false },
      { title: "Approval", key: "approval", sortable: false },
      { title: "Participation", key: "participation", sortable: false },
    ],
  }),
})
</script>

  <style lang="scss" scoped>
  .nav_entries {
    &__details {
      font-family: monospace;
      white-space: pre;
      font-size: $text-sm;
      padding: 1rem 5rem;
      background-color: $color-badge-navy;
      &:not(:last-of-type) {
        margin-bottom: 1.5rem;
      }
    }
    &__json{
      @include borderGray;
      background-color: $color-card-background;
      padding: 1.5rem;
      color: $color-primary;
    }
    &__no_data {
      text-align: center;
      padding: 1.5rem;
      background: $color-badge-navy;
    }
  }
  </style>
