<template>
  <div>
    <div
      v-if="isWhitelistEnabled"
      class="section_whitelist"
    >
      <div class="header">
        <div class="header__actions">
          <v-text-field
            v-model="search"
            label="Search"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            hide-details
            single-line
          />

          <v-btn
            v-if="isEditable"
            color="#ffffff"
            variant="text"
            :class="{ 'v-btn--active': isAddAddressListActive }"
            @click="toggleAddAddressList"
          >
            Add Address List +
          </v-btn>

          <v-btn
            v-if="isEditable"
            color="#ffffff"
            variant="text"
            :class="{ 'v-btn--active': isAddAddressActive }"
            @click="toggleAddAddress"
          >
            Add Address +
          </v-btn>
        </div>

        <div v-if="isAddAddressActive" class="header__new-address">
          <v-col cols="12">
            <v-label class="row-title">
              <div class="label_required row-title__title">
                Enter New Address
              </div>
            </v-label>

            <v-text-field
              ref="newAddressInputRef"
              v-model="newAddress"
              label="Address"
              variant="outlined"
              single-line
              :rules="singleAddressRules"
              @keydown.enter="isSingleAddressValid ? handleAddNewAddress() : null"
            />

            <div class="header__actions">
              <v-btn color="red" variant="text" @click="toggleAddAddress">
                Cancel
              </v-btn>

              <v-btn
                color="#ffffff"
                variant="outlined"
                :disabled="!isSingleAddressValid"
                @click="handleAddNewAddress"
              >
                Add Address
              </v-btn>
            </div>
          </v-col>
        </div>
      </div>

      <!-- Bulk add -->
      <div
        v-if="isAddAddressListActive"
        class="header__new-address"
      >
        <v-col cols="12">
          <v-label class="row-title">
            <div class="label_required row-title__title">
              Enter New Addresses
            </div>
          </v-label>

          <v-textarea
            ref="newAddressListInputRef"
            v-model="newAddress"
            label="Addresses"
            variant="outlined"
            single-line
            :error-messages="parsedBulkAddressErrors"
          />

          <div class="header__actions">
            <v-btn color="red" variant="text" @click="toggleAddAddressList">
              Cancel
            </v-btn>

            <v-btn
              color="#ffffff"
              variant="outlined"
              :disabled="!isBulkAddressValid"
              @click="openConfirmDialog"
            >
              Add New Address List
            </v-btn>
          </div>
        </v-col>

        <!-- Confirm dialog -->
        <UiConfirmDialog
          v-model="confirmDialog"
          title="Heads Up!"
          confirm-text="Add Address List"
          cancel-text="Cancel"
          message="By proceeding with <strong>'Add Address List'</strong>, all the previous addresses will be removed!"
          @confirm="handleAddNewAddressList"
        />
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
        items-per-page="10"
        :page="page"
      >
        <template #[`item.index`]="{ index }">
          <strong :class="`td_index  ${!isEditable ? 'disabled' : ''}`">{{ index + 1 }}</strong>
        </template>

        <template #[`item.address`]="{ item }">
          <div :class="`address ${!isEditable ? 'disabled' : ''}`">
            <span class="address__text">{{ item.address }}</span>

            <div v-if="item.deleted || item.isNew" class="address__state">
              <span
                v-if="item.deleted"
                class="address__state__deleted"
              >Removed</span>
              <span
                v-else-if="item.isNew"
                class="address__state__new"
              >Added</span>
            </div>
          </div>
        </template>

        <template v-if="isEditable" #[`item.delete`]="{ item }">
          <UiButtonDetails small @click.stop="deleteAddress(item)">
            <v-tooltip v-if="item.deleted" activator="parent" location="bottom">
              <template #default>
                Undo Delete
              </template>
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
              <template #default>
                Delete Address
              </template>
              <template #activator="{ props }">
                <v-icon
                  class="icon_delete"
                  icon="mdi-delete"
                  color="error"
                  v-bind="props"
                />
              </template>
            </v-tooltip>
          </UiButtonDetails>
        </template>

        <template #bottom>
          <v-pagination v-model="page" :length="pages" />
        </template>
      </v-data-table>

      <div v-else class="section_whitelist__no_data">
        Currently there are no addresses in the whitelist.
        <br>
        This means that all addresses are allowed to participate in the vault.
        <br>
      </div>
    </div>
    <div v-else>
      <UiInfoBox
        class="info-box"
        info="Whitelist is disabled. This means that anyone can deposit into the vault. <br>
                      If you want to enable the whitelist, please toggle the switch above. <br>
                      Whitelist is a list of addresses that are allowed to deposit into the vault."
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VTextarea, VTextField } from "vuetify/components";
import { useToastStore } from "~/store/toasts/toast.store";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";

const toastStore = useToastStore();

const props = defineProps({
  modelValue: {
    type: Array as () => IWhitelist[],
    default: () => [],
  },
  whitelistEnabled: {
    type: Boolean,
    default: false,
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:modelValue", "update:whitelistEnabled"]);
const items = computed({
  get: () => props?.modelValue || [],
  set: (value: Record<string, any>) => {
    emit("update:modelValue", value);
  },
});
const isWhitelistEnabled = computed({
  get: () => props.whitelistEnabled || false,
  set: (value: boolean) => {
    emit("update:whitelistEnabled", value);
  },
});

const loading = ref(false);
const search = ref("");
const page = ref(1);
const pages = computed(() => {
  const totalItems = items.value.length;
  if (totalItems == null) return 0;
  return Math.ceil(totalItems / 10);
});
const newAddressInputRef = ref<VTextField>();
const newAddressListInputRef = ref<VTextarea>();
const isAddAddressActive = ref(false);
const isAddAddressListActive = ref(false);
const newAddress = ref("");
const parsedBulkAddressErrors = ref<string[]>([]);
const confirmDialog = ref(false);

// Validation rules for a single address
const singleAddressRules = computed(() => [
  formRules.isValidAddress,
  formRules.required,
  formRules.notSameAs(
    items.value.map((i) => i.address),
    "This address is already in the whitelist",
  ),
]);

const bulkAddressRules = computed(() => {
  // Split addresses by newline
  const addressArray = newAddress.value.split(/\r?\n/).map((addr) => addr);

  // Define type for address count accumulator
  type AddressCount = Record<string, number>;

  // Count the occurrences of each address
  const addressCount: AddressCount = addressArray.reduce(
    (acc: AddressCount, address: string) => {
      acc[address] = (acc[address] || 0) + 1;
      return acc;
    },
    {},
  );

  // Filter the addresses to include only those appearing 2 or more times
  const addressList = addressArray.filter(
    (address: string) => addressCount[address] >= 2,
  );

  // Return validation rules
  return [
    formRules.isValidAddress,
    formRules.required,
    formRules.notSameAs(
      addressList,
      "This address is already in the whitelist",
    ),
  ];
});

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

const isSingleAddressValid = computed(() => {
  return singleAddressRules.value.every(
    (rule) => rule(newAddress.value) === true,
  );
});

const isBulkAddressValid = computed(() => {
  // we need to split the addresses by new line
  const addressList = newAddress.value.split(/\r?\n/).map((addr) => addr);

  const output = addressList.every((address) => {
    return bulkAddressRules.value.every((rule) => rule(address) === true);
  });

  const errors = addressList
    .map((address) => {
      // Collect all error messages for the current address
      const errorMessages = bulkAddressRules.value
        .map((rule) => rule(address)) // Apply each rule
        .filter((result) => typeof result === "string"); // Filter out valid results (true)

      // If there are error messages, return an object with address and messages
      if (errorMessages.length > 0) {
        return {
          address,
          errors: errorMessages,
        };
      }

      return null; // No errors for this address
    })
    .filter((item) => item !== null); // Filter out addresses with no errors

  parsedBulkAddressErrors.value = errors.map((error) => {
    if (!error.address) return "List is empty or contains empty lines";
    return error.address + ": " + error.errors.join(", ");
  });

  return output;
});

const openConfirmDialog = () => {
  confirmDialog.value = true;
};

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
    items.value = items.value.filter((i) => i.address !== item.address);
    return;
  }

  // if item is deleted, remove the deleted state
  item.deleted = !item.deleted;
};

const handleAddNewAddress = () => {
  try {
    const newWhitelistedAddress: IWhitelist = {
      address: newAddress.value,
      isNew: true,
      deleted: false,
    };

    items.value = [...items.value, newWhitelistedAddress];

    newAddress.value = "";
    // Reset the field and validation
    newAddressInputRef.value?.resetValidation();
    toastStore.successToast("New address added to the whitelist.");
  } catch (e) {
    console.log(e);
  }
};

const handleAddNewAddressList = () => {
  try {
    // we need to split the addresses by new line
    const addressList = newAddress.value.split(/\r?\n/).map((addr) => addr);

    items.value = addressList.map((address) => {
      return {
        address,
        isNew: true,
        deleted: false,
      };
    });

    newAddress.value = "";
    confirmDialog.value = false;
    // Reset the field and validation
    newAddressListInputRef.value?.resetValidation();
    toastStore.successToast("New addresses added to the whitelist.");
    isAddAddressListActive.value = false;
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
      padding: 0 0.25rem;
      margin-left: 0.5rem;
      font-size: $text-xs;
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
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;

    .v-btn {
      font-size: $text-xs;
      font-weight: 600;
    }
  }
  &__new-address {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
