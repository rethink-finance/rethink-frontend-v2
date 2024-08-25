<template>
  <div class="section_whitelist">
    <div class="header">
      <div class="header__actions">
        <v-text-field
          v-model="search"
          label="Search"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          single-line
        ></v-text-field>

        <v-btn
          color="#ffffff"
          @click="toggleAddAddressList"
          variant="text"
          :class="{ 'v-btn--active': isAddAddressListActive }"
        >
          Add Address List +
        </v-btn>

        <v-btn
          color="#ffffff"
          @click="toggleAddAddress"
          variant="text"
          :class="{ 'v-btn--active': isAddAddressActive }"
        >
          Add Address +
        </v-btn>
      </div>

      <div class="header__new-address" v-if="isAddAddressActive">
        <v-col cols="12">
          <v-label class="row-title">
            <div class="label_required row-title__title">Enter New Address</div>
          </v-label>

          <v-text-field
            v-model="newAddress"
            label="Address"
            variant="outlined"
            single-line
            :rules="newAddressRules"
          ></v-text-field>

          <div class="header__actions">
            <v-btn color="red" @click="toggleAddAddress" variant="text">
              Cancel
            </v-btn>

            <v-btn
              color="#ffffff"
              @click="handleAddNewAddress"
              variant="outlined"
              :disabled="!isAddAddressValid"
            >
              Add Address
            </v-btn>
          </div>
        </v-col>
      </div>
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
        <UiDetailsButton small @click.stop="deleteAddress(item)">
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

const props = defineProps<{
  items: IWhitelist[];
}>();
const emit = defineEmits(["update-items"]);

const loading = ref(false);
const search = ref("");
const pagination = ref({
  page: 1,
  rowsPerPage: 10,
  totalItems: 0,
});
const isAddAddressActive = ref(false);
const isAddAddressListActive = ref(false);
const newAddress = ref("");

const newAddressRules = computed(() => [
  formRules.isValidAddress,
  formRules.required,
  formRules.notSameAs(
    props.items.map((i) => i.address),
    "This address is already in the whitelist"
  ),
]);

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

const isAddAddressValid = computed(() => {
  const output = newAddressRules.value.every(
    (rule) => rule(newAddress.value) === true
  );

  console.log("isAddAddressValid: ", output);
  return output;
});

const toggleAddAddress = () => {
  isAddAddressActive.value = !isAddAddressActive.value;
  isAddAddressListActive.value = false;
};

const toggleAddAddressList = () => {
  isAddAddressListActive.value = !isAddAddressListActive.value;
  isAddAddressActive.value = false;

  if (isAddAddressListActive.value) {
    newAddress.value = "";
  }
};

const deleteAddress = (item: IWhitelist) => {
  // if item is new, remove it from the list
  if (item.isNew) {
    const updatedItems = props.items.filter((i) => i.address !== item.address);
    emit("update-items", updatedItems);
    return;
  }

  // if item is deleted, remove the deleted state
  item.deleted = !item.deleted;
};

const handleAddNewAddress = () => {
  try {
    const output: IWhitelist = {
      address: newAddress.value,
      isNew: true,
      deleted: false,
    };

    props.items.push(output);

    newAddress.value = "";
  } catch (e) {
    console.log(e);
  }
};
</script>

<style lang="scss" scoped>
.section_whitelist {
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

.header {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;

    .v-btn {
      font-size: 12px;
      font-weight: 600;
    }
  }
  &__new-address {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
