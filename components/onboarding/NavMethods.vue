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
          @click="isAddRawDialogOpen = true"
        >
          Add Raw
        </v-btn>
        <v-btn
          class="bg-primary text-secondary"
          @click="storeNavMethods"
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
        v-model:methods="managedNAVMethods"
        deletable
        show-simulated-nav
        idx="nav/onboarding"
        :fund-chain-id="fundChainId"
        :fund-address="fundSettings?.fundAddress"
        :safe-address="fundSettings?.safe"
        :base-symbol="fundSettings?.baseSymbol"
        :base-decimals="fundSettings?.baseDecimals"
        :is-fund-non-init="true"
      />
    </div>

    <FundNavAddRaw
      v-model="isAddRawDialogOpen"
      :methods="managedNAVMethods"
      @added-methods="addRawMethods"
    />

    <UiConfirmDialog
      :model-value="isDefineNewMethodDialogOpen"
      title="Add New Method"
      max-width="80%"
      @update:model-value="handleDefineNewMethodDialog"
    >
      <FundNavNewMethod
        :fund-address="fundSettings?.fundAddress"
        :base-token-address="fundSettings?.baseToken"
        @new-nav-method-created="onNewNavMethodCreatedHandler"
      />
    </UiConfirmDialog>

    <UiConfirmDialog
      :model-value="isAddFromLibraryDialogOpen"
      title="Add New Method"
      max-width="80%"
      @update:model-value="handleAddFromLibraryDialog"
    >
      <FundNavAddFromLibrary
        :chain-id="fundChainId"
        :fund-address="fundSettings?.fundAddress || ''"
        :safe-address="fundSettings?.safe || ''"
        :base-symbol="fundSettings?.baseSymbol || ''"
        :base-decimals="fundSettings?.baseDecimals || 18"
        :already-used-methods="managedNAVMethods"
        :is-fund-non-init="true"
        @methods-added="methodsAddedFromLibrary"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import type INAVMethod from "~/types/nav_method";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

const createFundStore = useCreateFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();

const { fundChainId, fundInitCache, fundSettings } = toRefs(createFundStore);

// Data
const loading = ref(false);
const isDefineNewMethodDialogOpen = ref(false)
const isAddFromLibraryDialogOpen = ref(false)
const isAddRawDialogOpen = ref(false)
const managedNAVMethods = ref<INAVMethod[]>([]);
const uniqueNavMethods = ref<INAVMethod[]>([]);
const allowManagerToKeepUpdatingNav = ref(false);
console.log("managedNAVMethods", managedNAVMethods.value)
console.log("uniqueNavMethods", uniqueNavMethods.value)

// Methods
const storeNavMethods = async () => {
  if (managedNAVMethods.value.length === 0) {
    toastStore.warningToast("No methods to store.");
    return;
  }
  const [ encodedRoleModEntries, targets, gasValues ] = [[], [], []];

  const fundFactoryContract = web3Store.chainContracts[fundChainId.value]?.fundFactoryContract;
  const navExecutorAddr = web3Store.NAVExecutorBeaconProxyAddress(fundChainId.value);
  const fundInitCacheSettings = fundInitCache?.value?.fundSettings;
  // storeNAV(address navExecutorAddr, bytes calldata data) external {
  // TODO parse & prepare NAV methods data

  const calldata = [
    targets,
    gasValues,
    encodedRoleModEntries,
  ];
  try {
    console.log("STORE NAV DATA", calldata);
    await fundFactoryContract
      .send("storeNAV", {}, ...calldata)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Store permissions transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Permissions stored successfully.");
        } else {
          toastStore.errorToast(
            "Storing permissions has failed. Please contact the Rethink Finance support.",
          );
        }
        loading.value = false;
      })
      .on("error", (error: any) => {
        console.error(error);
        loading.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    loading.value = false;
    toastStore.errorToast(error.message);
  }
};
const onNewNavMethodCreatedHandler = (navMethod: INAVMethod) => {
  // Add newly defined NAV entry to fund managed methods.
  managedNAVMethods.value.push(navMethod);

  // close modal and clear form
  handleDefineNewMethodDialog(false);

  toastStore.addToast("Method added successfully.")
}

const handleDefineNewMethodDialog = (value: boolean) => {
  isDefineNewMethodDialogOpen.value = value;
};
const handleAddFromLibraryDialog = (value: boolean) => {
  isAddFromLibraryDialogOpen.value = value;
};

const addRawMethods = (newMethods: INAVMethod[]) => {
  managedNAVMethods.value = [
    ...managedNAVMethods.value,
    ...newMethods,
  ];
};

const methodsAddedFromLibrary = (methods: INAVMethod[]) => {
  // // Add newly defined method to fund managed methods.
  for (const method of methods) {
    method.isNew = true;
    managedNAVMethods.value.push(method);
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
