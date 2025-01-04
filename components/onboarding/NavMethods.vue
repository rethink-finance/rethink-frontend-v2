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
            v-model="allowManagerToUpdateNav"
            color="primary"
            hide-details
          />
        </div>
      </div>

      <FundNavMethodsTable
        v-model:methods="navMethods"
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
      :methods="navMethods"
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
        :already-used-methods="navMethods"
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
import {
  encodeUpdateNavMethods,
  getAllowManagerToUpdateNavProposalData,
} from "~/composables/nav/navProposal";
import { NAVExecutorBeaconProxyAddress } from "assets/contracts/rethinkContractAddresses";

const createFundStore = useCreateFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();

const { fundChainId, fundInitCache, fundSettings } = toRefs(createFundStore);

// Data
const isLoadingStoreNavMethods = ref(false);
const isLoadingAllowManagerToUpdateNav = ref(false);
const isDefineNewMethodDialogOpen = ref(false)
const isAddFromLibraryDialogOpen = ref(false)
const isAddRawDialogOpen = ref(false)
const navMethods = ref<INAVMethod[]>([]);
const allowManagerToUpdateNav = ref(false);

/**
 * Computed
 */
const fundFactoryContract = computed(() => web3Store.chainContracts[fundChainId.value]?.fundFactoryContract)


/**
 * Methods
 */
const storeNavMethods = async () => {
  if (navMethods.value.length === 0) {
    return toastStore.warningToast("No methods to store.");
  }

  // storeNAV(address navExecutorAddr, bytes calldata data) external {
  // TPrepare NAV methods data.
  isLoadingStoreNavMethods.value = true;
  const encodedNavUpdateEntries = encodeUpdateNavMethods(
    navMethods.value,
    fundSettings?.value?.baseDecimals,
  );

  await sendStoreNavMethodsTransaction(encodedNavUpdateEntries);

  if (allowManagerToUpdateNav.value) {
    await sendAllowManagerToUpdateNavTransaction(encodedNavUpdateEntries);
  }
};

const sendStoreNavMethodsTransaction = async (
  encodedNavUpdateEntries: string,
) => {
  if (!fundSettings?.value?.fundAddress) {
    return toastStore.errorToast("Fund address is missing.");
  }
  const navExecutorAddress = NAVExecutorBeaconProxyAddress(fundChainId.value);

  try {
    console.log("STORE NAV DATA",
      JSON.stringify(
        [
          navExecutorAddress,
          encodedNavUpdateEntries,
        ],
        null,
        2,
      ),
    );
    await fundFactoryContract.value
      .send(
        "storeNAV",
        {},
        ...[
          navExecutorAddress,
          encodedNavUpdateEntries,
        ],
      )
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Store NAV methods transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("NAV methods stored successfully.");
        } else {
          toastStore.errorToast(
            "Storing NAV methods has failed. Please contact the Rethink Finance support.",
          );
        }
        isLoadingStoreNavMethods.value = false;
      })
      .on("error", (error: any) => {
        console.error(error);
        isLoadingStoreNavMethods.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    isLoadingStoreNavMethods.value = false;
    toastStore.errorToast(error.message);
  }
}


const sendAllowManagerToUpdateNavTransaction = async (
  encodedNavUpdateEntries: string,
) => {
  if (!fundSettings?.value?.fundAddress) {
    return toastStore.errorToast("Fund address is missing.");
  }
  if (!fundInitCache?.value?.rolesModifier) {
    return toastStore.errorToast("Roles modifier address is missing.");
  }
  isLoadingAllowManagerToUpdateNav.value = true;

  const allowManagerToUpdateNavProposal = getAllowManagerToUpdateNavProposalData(
    encodedNavUpdateEntries,
    fundSettings?.value?.fundAddress,
    fundChainId.value,
    fundInitCache?.value?.rolesModifier,
  );

  try {
    console.log("submitPermissions allowManagerToUpdateNavProposal", allowManagerToUpdateNavProposal);
    await fundFactoryContract.value
      .send(
        "submitPermissions",
        {},
        ...[
          allowManagerToUpdateNavProposal.targets,
          allowManagerToUpdateNavProposal.gasValues,
          allowManagerToUpdateNavProposal.calldatas,
        ],
      )
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "Submit NAV permissions transaction has been submitted. Please wait for it to be confirmed.",
        );
      })
      .on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("NAV permissions submitted successfully.");
        } else {
          toastStore.errorToast(
            "Submitting NAV permissions has failed. Please contact the Rethink Finance support.",
          );
        }
        isLoadingAllowManagerToUpdateNav.value = false;
      })
      .on("error", (error: any) => {
        console.error(error);
        isLoadingAllowManagerToUpdateNav.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance support.",
        );
      });
  } catch (error: any) {
    isLoadingAllowManagerToUpdateNav.value = false;
    toastStore.errorToast(error.message);
  }
}

const onNewNavMethodCreatedHandler = (navMethod: INAVMethod) => {
  // Add newly defined NAV entry to fund managed methods.
  navMethods.value.push(navMethod);

  // close modal and clear form
  handleDefineNewMethodDialog(false);
  console.log("new", navMethods.value);

  toastStore.addToast("Method added successfully.")
}

const handleDefineNewMethodDialog = (value: boolean) => {
  isDefineNewMethodDialogOpen.value = value;
};
const handleAddFromLibraryDialog = (value: boolean) => {
  isAddFromLibraryDialogOpen.value = value;
};

const addRawMethods = (newMethods: INAVMethod[]) => {
  navMethods.value = [
    ...navMethods.value,
    ...newMethods,
  ];
};

const methodsAddedFromLibrary = (methods: INAVMethod[]) => {
  // // Add newly defined method to fund managed methods.
  for (const method of methods) {
    method.isNew = true;
    navMethods.value.push(method);
  }

  handleAddFromLibraryDialog(false);
  toastStore.addToast("Methods added successfully.");
};
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
