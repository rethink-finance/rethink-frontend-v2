<template>
  <div class="nav-methods">
    <div class="nav_head">
      <h2 class="nav_head__title">
        Manage NAV methods
      </h2>
      <div class="nav_head__actions">
        <button
          type="button"
          class="nav_head__action"
          @click="handleDefineNewMethodDialog(true)"
        >
          Define new method
        </button>
        <button
          type="button"
          class="nav_head__action"
          @click="handleAddFromLibraryDialog(true)"
        >
          Add from library
        </button>
        <button
          type="button"
          class="nav_head__action"
          @click="isAddRawDialogOpen = true"
        >
          Import raw
        </button>
      </div>
    </div>

    <div class="nav_toggle_row">
      <span class="nav_toggle_row__text">
        Allow manager to keep updating NAV based on approved methods
      </span>
      <OnboardingToggle
        v-model="allowManagerToUpdateNav"
        label="Allow the manager to keep updating NAV"
      />
    </div>

    <div class="nav_table">
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
        :fund-factory-contract-v2-used="fundFactoryContractV2Used"
      />
    </div>

    <FundNavAddRaw
      v-model="isAddRawDialogOpen"
      :methods="navMethods"
      @added-methods="addRawMethods"
    />

    <UiConfirmDialog
      :model-value="isDefineNewMethodDialogOpen"
      title="Define new method"
      max-width="560px"
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
      title="Add from library"
      max-width="760px"
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
      title="Store NAV methods"
      confirm-text="Send both"
      class="confirm_dialog"
      max-width="640px"
      @confirm="isNotifyDialogOpen = false"
      @cancel="isNotifyDialogOpen = false"
    >
      <p class="nav_notify__lead">
        This action requires sending two transactions:
      </p>

      <ol class="nav_notify__list">
        <li class="nav_notify__item">
          <span class="nav_notify__number">1</span>
          Store the NAV methods.
        </li>
        <li class="nav_notify__item">
          <span class="nav_notify__number">2</span>
          Allow the manager to keep updating NAV based on approved methods.
        </li>
      </ol>

      <p class="nav_notify__lead">
        Please ensure you approve both to complete the process.
      </p>
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
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

const { fundChainId, fundInitCache, fundSettings, fundFactoryContractV2Used } = storeToRefs(createFundStore);

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
const fundFactoryContract = computed(() => {
  const chainContracts = web3Store.chainContracts[fundChainId.value];
  return fundFactoryContractV2Used.value ? chainContracts?.fundFactoryContractV2 : chainContracts?.fundFactoryContract
})

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

  let encodedNavUpdateEntries;
  try {
    encodedNavUpdateEntries = encodeUpdateNavMethods(
      navMethods.value,
      fundSettings?.value?.baseDecimals,
    );
  } catch (error: any) {
    console.error("Failed encoding NAV methods (encodeUpdateNavMethods): ", error);
    isLoadingStoreNavMethods.value = false;
    return toastStore.errorToast("Failed encoding NAV methods, " + error.message);
  }

  try {
    // TODO if this trx fails, there is no need to send the next one.
    await sendStoreNavMethodsTransaction(encodedNavUpdateEntries);
  } catch (error: any) {
    console.error("Failed storing NAV methods ", error);
    isLoadingStoreNavMethods.value = false;
    return toastStore.errorToast("Failed storing NAV methods, " + error.message);
  }

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
  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
  const navExecutorAddress = getNAVExecutorBeaconProxyAddress(fundChainId.value);

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
    // TODO: the permissions also need to change for Roles v1 vs Roles v2
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

// The step's primary action sits in the page's sticky footer with every other
// step's, so the page drives it from there.
defineExpose({
  storeNavMethods: handleClickStoreNavMethods,
  isStoring: isLoadingStoreNavMethods,
});
</script>

<style scoped lang="scss">
.nav_head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;

  &__title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    margin-left: auto;
  }

  &__action {
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-white;
    cursor: pointer;
    transition: border-color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }
  }
}

.nav_toggle_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.875rem 1.125rem;
  margin-top: 1.375rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__text {
    font-size: 13.5px;
    line-height: 1.5;
    color: $color-white;
  }
}

.nav_table {
  margin-top: 1rem;
  /* The table is shared with the vault's own NAV page and brings its own
     column widths; this only gives it somewhere to scroll on a narrow screen. */
  overflow-x: auto;
}

.nav_notify {
  &__lead {
    font-size: 13.5px;
    line-height: 1.55;
    color: $color-white;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0.75rem 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 13.5px;
    line-height: 1.4;
    color: $color-white;
  }

  &__number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 20px;
    height: 20px;
    border: 1px solid $color-cyan-line;
    border-radius: 999px;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-cyan;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav_head__action {
    transition: none;
  }
}
</style>
