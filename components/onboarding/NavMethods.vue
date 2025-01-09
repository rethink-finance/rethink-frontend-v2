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
        :loading="isFetchingNavMethods"
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
import { ERR_CONTRACT_EXECUTION_REVERTED } from "web3";
import { useToastStore } from "~/store/toasts/toast.store";
import type INAVMethod from "~/types/nav_method";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import {
  decodeUpdateNavMethods,
  encodeUpdateNavMethods,
  getAllowManagerToUpdateNavPermissionsData,
} from "~/composables/nav/navProposal";
import { NAVExecutorBeaconProxyAddress } from "assets/contracts/rethinkContractAddresses";
import { NAVExecutor } from "assets/contracts/NAVExecutor";
import { parseNAVMethod } from "~/composables/parseNavMethodDetails";
import { useFundsStore } from "~/store/funds/funds.store";

const fundsStore = useFundsStore();
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
  getNAVData();
})

watch(() => fundSettings?.value?.fundAddress, (fundAddress?: string) => {
  if (fundAddress) {
    getNAVData();
  }
})

const getNAVData = async () => {
  const navExecutorAddress = NAVExecutorBeaconProxyAddress(fundChainId.value);
  const fundAddress = fundSettings?.value?.fundAddress;
  if (!fundAddress) return;
  isFetchingNavMethods.value = true;

  // if (!fundsStore.allNavMethods?.length) {
  const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(fundChainId.value);

  // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
  // and make sure it is fetched before checking here with fundsStore.fetchFundsNavMethods, and then we
  // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
  console.log("simulate fetch all nav methods")
  await fundsStore.fetchFundsNavMethods(
    fundChainId.value,
    fundsInfoArrays,
    true,
  );
  // }

  try {
    const navExecutorContract = web3Store.getCustomContract(
      fundChainId.value,
      NAVExecutor.abi,
      navExecutorAddress,
    );

    const updateNavDataEncoded: string = await web3Store.callWithRetry(
      fundChainId.value,
      () =>
        navExecutorContract.methods.getNAVData(fundAddress).call(),
      1,
      [ERR_CONTRACT_EXECUTION_REVERTED],
    );
    // Decode NAV methods.
    const updateNavDataDecoded = decodeUpdateNavMethods(updateNavDataEncoded);

    // Parse NAV methods.
    for (const [navMethodIndex, navMethod] of updateNavDataDecoded.navUpdateData.entries()) {
      // Don't push that method if it exists already, match by detailsHash.
      const parsedNavMethod = parseNAVMethod(navMethodIndex, navMethod);
      if (navMethods.value.some((m: INAVMethod) => m.detailsHash === parsedNavMethod.detailsHash)) {
        continue
      }
      navMethods.value.push(parsedNavMethod);
    }
  } catch (error: any) {
    // If execution was reverted, is probably because methods don't exist and
    // there is a require in contract "null output data". Could also check
    // if error.cause includes the "null output data", just to be sure.
    if (error.code !== ERR_CONTRACT_EXECUTION_REVERTED) {
      console.error("Failed loading NAV methods data.", error, error.code);
      toastStore.errorToast("Failed loading NAV methods data. " + error.message);
    }
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
