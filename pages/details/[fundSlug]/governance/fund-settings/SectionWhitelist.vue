<template>
  <div class="section_whitelist">
    <div class="section_whitelist__actions">
      <v-text-field
        v-model="search"
        label="Search"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        hide-details
        single-line
      ></v-text-field>
    </div>
    <v-skeleton-loader v-if="loading" type="table" />
    <v-data-table
      v-else-if="items.length"
      class="section_whitelist__table"
      :headers="headers"
      :items="items"
      :cell-props="methodProps"
      :search="search"
      hide-default-header
      hover
      hide-actions
      :pagination.sync="pagination"
      items-per-page="10"
    >
      <template #[`item.index`]="{ index }">
        <strong class="td_index">{{ index + 1 }}</strong>
      </template>

      <template #[`item.address`]="{ item }">
        <div class="address">
          <span class="address__text">{{ item.address }}</span>

          <div class="address__state" v-if="item.deleted || item.isNew">
            <span v-if="item.deleted" class="address__state__deleted"
              >Removed</span
            >
            <span v-else-if="item.isNew" class="address__state__new"
              >Added</span
            >
          </div>
        </div>
      </template>

      <template #[`item.delete`]="{ item }">
        <UiDetailsButton small @click.stop="deleteMethod(item)">
          <v-tooltip v-if="item.deleted" activator="parent" location="bottom">
            <template #default> Undo Delete </template>
            <template #activator="{ props }">
              <v-icon
                class="icon_delete"
                icon="mdi-arrow-u-left-top"
                color="secondary"
                v-bind="props"
              />
            </template>
          </v-tooltip>

          <v-tooltip v-else activator="parent" location="bottom">
            <template #default> Delete Address </template>
            <template #activator="{ props }">
              <v-icon
                class="icon_delete"
                icon="mdi-delete"
                color="error"
                v-bind="props"
              />
            </template>
          </v-tooltip>
        </UiDetailsButton>
      </template>

      <template #bottom>
        <v-pagination
          v-if="pages > 1"
          v-model="pagination.page"
          :length="pages"
        ></v-pagination>
      </template>
    </v-data-table>

    <div v-else class="section_whitelist__no_data">No Whitelist</div>
  </div>
</template>

<script setup lang="ts">
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

const loading = ref(false);
const search = ref("");
const pagination = ref({
  page: 1,
  rowsPerPage: 10,
  totalItems: 0,
});

const props = defineProps<{
  items: IWhitelist[];
}>();

const headers = computed(() => {
  const headers: any[] = [
    { title: "", key: "index", sortable: true },
    {
      title: "",
      key: "address",
      sortable: true,
    },
    {
      title: "",
      key: "delete",
      align: "end",
    },
  ];

  return headers;
});

const pages = computed(() => {
  if (
    pagination.value.rowsPerPage == null ||
    pagination.value.totalItems == null
  )
    return 0;

  return Math.ceil(pagination.value.totalItems / pagination.value.rowsPerPage);
});

const methodProps = ({ item }: { item: IWhitelist }) => {
  if (item.deleted) {
    return {
      class: "tr_deleted",
    };
  } else if (item.isNew) {
    return {
      class: "tr_is_new",
    };
  }
  return {};
};

const deleteMethod = (item: IWhitelist) => {
  item.deleted = !item.deleted;
};
</script>

<style lang="scss" scoped>
.section_whitelist {
  &__actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  &__table {
    :deep(.tr_deleted) {
      color: $color-light-border;

      .td_index {
        color: $color-error;
      }
    }
    :deep(.tr_is_new) {
      .td_index {
        color: $color-success;
      }
    }

    :deep(.details_button) {
      opacity: 0;
      margin-left: auto;

      transition: opacity 0.2s ease-in-out;
    }

    // when row is hovered show the delete button
    :deep(.v-data-table__tr:hover .details_button) {
      opacity: 1;
    }
  }
  .address {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &__state {
      padding: 0px 4px;
      margin-left: 0.5rem;

      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;

      @include borderGray;
      background-color: $color-gray-light-transparent;

      // different colors for different states
      &__deleted {
        color: $color-error;
      }
      &__new {
        color: $color-success;
      }
    }
  }

  &__no_data {
    text-align: center;
    padding: 1.5rem;
    background: $color-badge-navy;
  }
}
</style>
