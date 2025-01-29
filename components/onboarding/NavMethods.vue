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
          :loading="isLoadingStoreNavMethods"
          @click="handleClickStoreNavMethods"
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
        :loading="isFetchingNavMethods"
        :fund-address="fundSettings?.fundAddress"
        :safe-address="fundSettings?.safe"
        :base-symbol="fundSettings?.baseSymbol"
        :base-decimals="fundSettings?.baseDecimals"
        :safe-contract-base-token-balance="safeContractBaseTokenBalance"
        :show-safe-contract-balance="true"
        :show-summary-row="true"
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

    <UiConfirmDialog
      v-model="isNotifyDialogOpen"
      title="Store NAV Methods"
      class="confirm_dialog"
      max-width="680px"
      @cancel="isNotifyDialogOpen = false"
    >
      <p class="mt-4">
        This action requires sending two transactions:
      </p>

      <div class="d-flex flex-column mt-2">
        <div class="d-flex flex-row align-items-center">
          <Icon icon="mynaui:one-circle" width="24" height="24" />
          <strong class="ms-1">
            Store the NAV methods.
          </strong>
        </div>
        <div class="d-flex flex-row align-items-center mt-1">
          <Icon icon="mynaui:two-circle" width="24" height="24" />
          <strong class="ms-1">
            Allow the manager to keep updating NAV based on approved methods.
          </strong>
        </div>
      </div>
      <p class="mt-4">
        Please ensure you approve both to complete the process.
      </p>
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { NAVExecutorBeaconProxyAddress } from "assets/contracts/rethinkContractAddresses";
import { ERC20 } from "~/assets/contracts/ERC20";
import {
  encodeUpdateNavMethods,
  getAllowManagerToUpdateNavPermissionsData,
} from "~/composables/nav/navProposal";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { getNAVData } from "~/store/fund/actions/fetchFundNAVData.action";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type INAVMethod from "~/types/nav_method";

const createFundStore = useCreateFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();

const { fundChainId, fundInitCache, fundSettings } = storeToRefs(createFundStore);

// Data
const isFetchingNavMethods = ref(false);
const isLoadingStoreNavMethods = ref(false);
const isLoadingAllowManagerToUpdateNav = ref(false);
const isDefineNewMethodDialogOpen = ref(false)
const isAddFromLibraryDialogOpen = ref(false)
const isAddRawDialogOpen = ref(false)
const isNotifyDialogOpen = ref(false)
const navMethods = ref<INAVMethod[]>([]);
const allowManagerToUpdateNav = ref(false);
const safeContractBaseTokenBalance = ref(0);

/**
 * Computed
 */
const fundFactoryContract = computed(() => web3Store.chainContracts[fundChainId.value]?.fundFactoryContract)


/**
 * Methods
 */
const handleClickStoreNavMethods = () => {
  if (allowManagerToUpdateNav.value) {
    isNotifyDialogOpen.value = true;
  }

  storeNavMethods();
}
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

  // TODO if this trx fails, there is no need to send the next one.
  await sendStoreNavMethodsTransaction(encodedNavUpdateEntries);

  if (allowManagerToUpdateNav.value) {
    // Submit permission to allow manager to keep updating NAV.
    await sendAllowManagerToUpdateNavTransaction();
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


const sendAllowManagerToUpdateNavTransaction = async () => {
  if (!fundSettings?.value?.fundAddress) {
    return toastStore.errorToast("Fund address is missing.");
  }
  if (!fundInitCache?.value?.rolesModifier) {
    return toastStore.errorToast("Roles modifier address is missing.");
  }
  isLoadingAllowManagerToUpdateNav.value = true;

  const allowManagerToUpdateNavPermission =
    getAllowManagerToUpdateNavPermissionsData(
      fundSettings?.value?.fundAddress,
      fundChainId.value,
      fundInitCache?.value?.rolesModifier,
    );

  try {
    console.log("submitPermissions allowManagerToUpdateNavPermission", allowManagerToUpdateNavPermission);
    await fundFactoryContract.value
      .send(
        "submitPermissions",
        {},
        allowManagerToUpdateNavPermission.calldatas,
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

onMounted(() => {
  fetchNavMethods();
  fetchSafeBalance();
})

watch(() => fundSettings?.value?.fundAddress, (fundAddress?: string) => {
  if (fundAddress) {
    fetchNavMethods();
  }
})

watch(()=> fundSettings?.value?.safe, (safeAddress?: string) => {
  if (safeAddress) {
    fetchSafeBalance();
  }
})


const fetchSafeBalance = async () => {
  if (!fundSettings?.value?.safe) return;
  let balanceWei = BigInt(0)

  const fundBaseTokenContract = web3Store.getCustomContract(
    fundChainId.value,
    ERC20,
    fundSettings.value?.baseToken, // baseToken
  );

  try {
    balanceWei = await web3Store.callWithRetry(
      fundChainId.value,
      () => fundBaseTokenContract.methods
        .balanceOf(fundSettings.value?.safe)
        .call(),
    );

  } catch (error: any) {
    toastStore.errorToast("Failed loading safe balance. " + error.message);
  } finally {
    console.log("SAFE BALANCE", balanceWei);
    safeContractBaseTokenBalance.value = Number(balanceWei);
  }
}

const fetchNavMethods = async () => {
  if (!fundSettings?.value?.fundAddress) return;

  isFetchingNavMethods.value = true;

  try {
    const fetchedNavMethods = await getNAVData(
      fundChainId.value,
      fundSettings?.value?.fundAddress,
    );

    for (const navMethod of fetchedNavMethods) {
      // Don't push that method if it exists already, match by detailsHash.
      if (navMethods.value.some((existingMethod: INAVMethod) => existingMethod.detailsHash === navMethod.detailsHash)) {
        continue
      }
      navMethods.value.push(navMethod);
    }
  } catch (error: any) {
    toastStore.errorToast("Failed loading NAV methods data. " + error.message);
  }
  isFetchingNavMethods.value = false;
}
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
