<template>
  <v-data-table
    v-if="items.length || loading"
    class="table-trending-delegates main_table"
    :headers="headers"
    :items="items"
    items-per-page="-1"
    :loading="loading"
  >
    <template #[`item.delegated_members`]="{ item }">
      <div class="data-cell__title">
        <div class="data-cell__text">
          {{ truncateAddress(item.delegated_members) }}
        </div>
        <ui-tooltip-click location="right">
          <Icon
            icon="clarity:copy-line"
            class="copy-icon"
            width="1rem"
            @click="copyText(item.delegated_members)"
          />

          <template #tooltip>
            <div class="tooltip__content">
              <span>Copied</span>
            </div>
          </template>
        </ui-tooltip-click>
      </div>
    </template>

    <template #bottom>
      <!-- Leave this slot empty to hide pagination controls -->
    </template>
  </v-data-table>
  <div v-else-if="items.length === 0 && !loading" class="nav_entries__no_data">
    No Governance Activity details available.
  </div>
</template>

<script lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import type ITrendingDelegates from "~/types/trending_delegates";

export default defineComponent({
  name: "TableTrengingDelegates",
  props: {
    items: {
      type: Array as () => ITrendingDelegates[],
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    // bug fix for vuetify table headers property 'align'
    // https://github.com/vuetifyjs/vuetify/issues/18901
    headers: ref([
      {
        title: "Delegated Members",
        key: "delegated_members",
        sorable: false,
      },
      {
        title: "Delegators",
        key: "delegators",
        value: (v: any) => pluralizeWord("member", v.delegators),
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
  }),
  methods: {
    truncateAddress,
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
    gap: 8px;
    align-items: center;
    padding-block: 1rem;
  }
  &__text {
    width: 40%;
    max-width: 120px;
    min-width: 110px;
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
