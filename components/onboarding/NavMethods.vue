<template>
  <div class="nav-methods">
    <UiHeader>
      <div class="main_header__title">
        Manage NAV Methods
      </div>
      <div>
        <v-btn
          class="text-secondary me-4"
          variant="outlined"
          @click="handleDefineNewMethodDialog(true)"
        >
          Define New Method
        </v-btn>
        <v-btn
          class="text-secondary me-4"
          variant="outlined"
          @click="handleAddFromLibraryDialog(true)"
        >
          Add From Library
        </v-btn>
        <v-btn
          class="text-secondary me-4"
          variant="outlined"
          @click="addRawDialog = true"
        >
          Add Raw
        </v-btn>
        <v-btn
          class="bg-primary text-secondary"
          @click="storeNavMethods()"
        >
          Store NAV Methods
        </v-btn>

      </div>
    </UiHeader>
    <div class="main_card">

      <div class="management">
        <div class="management__row">
          <div>
            Allow manager to keep updating NAV based on approved methods
          </div>
          <v-switch
            v-model="allowManagerToKeepUpdatingNav"
            color="primary"
            hide-details
          />
        </div>
      </div>

      <FundNavMethodsTable
        v-model:methods="fundManagedNAVMethods"
        deletable
        show-simulated-nav
        idx="nav/onboarding"
        :fund-chain-id="chainId"
        :fund-address="fundAddress"
      />
    </div>


    <FundNavAddRaw
      v-model="addRawDialog"
      :methods="fundManagedNAVMethods"
      @added-methods="addRawMethods"
    />

    <UiConfirmDialog
      :model-value="defineNewMethodDialog"
      title="Add New Method"
      max-width="80%"
      @update:model-value="handleDefineNewMethodDialog"
    >
      <FundNavNewMethod
        :fund-address="fundAddress"
        :base-token-address="baseTokenAddress"
        @new-nav-method-created="onNewNavMethodCreatedHandler"
      />
    </UiConfirmDialog>

    <UiConfirmDialog
      :model-value="addFromLibraryDialog"
      title="Add New Method"
      max-width="80%"
      @update:model-value="handleAddFromLibraryDialog"
    >
      <FundNavAddFromLibrary
        :chain-id="chainId"
        :fund-address="fundAddress"
        :already-used-methods="fundManagedNAVMethods"
        @add-methods="addFromLibrary"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import type INAVMethod from "~/types/nav_method";


const toastStore = useToastStore();

// Props
const props = defineProps({
  chainId: {
    type: String,
    required: true,
  },
  fundAddress: {
    type: String,
    required: true,
  },
  baseTokenAddress: {
    type: String,
    required: true,
  },

})

// Data
const defineNewMethodDialog = ref(false)
const addFromLibraryDialog = ref(false)
const addRawDialog = ref(false)
const fundManagedNAVMethods = ref<INAVMethod[]>([]);
const uniqueNavMethods = ref<INAVMethod[]>([]);
const allowManagerToKeepUpdatingNav = ref(false);


console.log("fundManagedNAVMethods", fundManagedNAVMethods.value)
console.log("uniqueNavMethods", uniqueNavMethods.value)

// Computeds

// Methods
const storeNavMethods = () => {
  if(fundManagedNAVMethods.value.length === 0) {
    toastStore.warningToast("No methods to store.");
    return;
  }

  toastStore.successToast("Methods added successfully.");
};
const onNewNavMethodCreatedHandler = (navMethod: INAVMethod) => {
  // Add newly defined NAV entry to fund managed methods.
  fundManagedNAVMethods.value.push(navMethod);

  // close modal and clear form
  handleDefineNewMethodDialog(false);

  toastStore.addToast("Method added successfully.")
}

const handleDefineNewMethodDialog = (value: boolean) => {
  defineNewMethodDialog.value = value;
};
const handleAddFromLibraryDialog = (value: boolean) => {
  addFromLibraryDialog.value = value;
};

const addRawMethods = (newMethods: INAVMethod[]) => {
  fundManagedNAVMethods.value = [
    ...fundManagedNAVMethods.value,
    ...newMethods,
  ];
};

const addFromLibrary = (methods: INAVMethod[]) => {
  // // Add newly defined method to fund managed methods.
  for (const method of methods) {
    method.isNew = true;
    fundManagedNAVMethods.value.push(method);
  }

  handleAddFromLibraryDialog(false);
  toastStore.addToast("Methods added successfully.");
};


// Watchers

// Lifecycle Hooks
</script>

<style scoped lang="scss">
.management {
  margin-bottom: 1rem;
  &__row {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    gap: 2rem;
  }
}
</style>
