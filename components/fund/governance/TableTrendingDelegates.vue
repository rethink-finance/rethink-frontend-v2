<template>
  <v-data-table
    v-if="items.length"
    :headers="headers"
    :items="items"
    class="table-trending-delegates"
  >
    <template #[`item.delegated_members`]="{ item }">
      <div class="data-cell__title">
        <div>{{ formatHexAddress(item.delegated_members) }}</div>
        <ui-tooltip-click tooltip-text="Copied" location="right">
          <Icon
            icon="clarity:copy-line"
            class="copy-icon"
            width="1rem"
            @click="copyText(item.delegated_members)"
          />
        </ui-tooltip-click>
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
// types
import type ITrendingDelegates from "~/types/trending_delegates";
// utils
import { formatHexAddress } from "~/composables/utils";

export default defineComponent({
  name: "TableTrengingDelegates",
  props: {
    items: {
      type: Array as () => ITrendingDelegates[],
      default: () => [],
    },
  },
  data: () => ({
    expanded: [],
    // bug fix for vuetify table headers property 'align'
    // https://github.com/vuetifyjs/vuetify/issues/18901
    headers: ref([
      {
        title: "Delegated Members",
        key: "delegated_members",
        value: (v: any) => v.delegated_members + " members",
        sorable: false,
      },
      {
        title: "Delegators",
        key: "delegators",
        sortable: true,
      },
      {
        title: "Impact",
        key: "impact",
        sortable: true,
        align: "end",
      },
      {
        title: "Voting Power",
        key: "voting_power",
        sortable: true,
        align: "end",
      },
    ] as const),
    _timerId: null as any as number | null,
  }),
  methods: {
    rowClick(index: any, item: any) {
      console.log("Row clicked", item);
    },
    copyText(text: string) {
      navigator.clipboard.writeText(text);
    },
  },
});
</script>

<style lang="scss" scoped>
.table-trending-delegates {
  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }

  &:deep(.v-table__wrapper table) {
    // add border spacing only between rows
    --row-spacing: 1.5rem;
    border-spacing: 0 var(--row-spacing);
    margin-top: calc(-1 * var(--row-spacing));

    // remove header bg-color and border
    thead {
      border-spacing: 0;
      background-color: unset;
      th {
        border: none;
      }
    }

    tbody {
      tr {
        td {
          // add border between rows
          border: 1px solid $color-gray-transparent;
          border-left: none;
          border-right: none;

          // first and last child border radius
          &:first-child {
            border-left: 1px solid $color-gray-transparent;
            border-radius: $default-border-radius 0 0 $default-border-radius;
          }
          &:last-child {
            border-right: 1px solid $color-gray-transparent;
            border-radius: 0 $default-border-radius $default-border-radius 0;
          }
        }
      }
    }
  }
}

.data-cell {
  &__title {
    display: flex;
    gap: 24px;
    align-items: center;
    padding-block: 1rem;
  }
}

.copy-icon {
  margin-bottom: -0.2rem;
  cursor: pointer;
  color: $color-steel-blue;

  rotate: 180deg;
  transform: scaleX(-1);
}
</style>
