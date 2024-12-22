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
          @click="addFromLibraryDialog = true"
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

      </div>
    </UiHeader>

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

    {{ fundManagedNAVMethods }}

    <!-- <FundNavAddFromLibrary
      :methods="uniqueNavMethods"
      :used-methods="fundManagedNAVMethods"
      @add-methods="addFromLibrary"
    /> -->
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import type INAVMethod from "~/types/nav_method";


const toastStore = useToastStore();

// Props
const props = defineProps({
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


console.log("fundManagedNAVMethods", fundManagedNAVMethods.value)
console.log("uniqueNavMethods", uniqueNavMethods.value)

// Computeds

// Methods

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

  toastStore.addToast("Methods added successfully.");
};


// Watchers

// Lifecycle Hooks
</script>

<style scoped lang="scss">
</style>
