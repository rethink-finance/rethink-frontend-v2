<template>
  <div class="nav_methods">
    <div class="nav_methods__head">
      <h2 class="nav_methods__title">
        NAV Methods
      </h2>
    </div>

    <div class="nav_methods__toggle_row">
      <span class="nav_methods__toggle_text">
        Allow manager to keep updating NAV based on approved methods
      </span>
      <!-- Already granted (the Permissions step's "Update NAV" switch does
           the same): nothing left to decide here, so no switch. -->
      <span v-if="isNavPermissionHeld" class="nav_methods__toggle_state">
        <Icon icon="material-symbols:check" width="0.875rem" height="0.875rem" />
        Already allowed
      </span>
      <OnboardingToggle
        v-else
        v-model="allowManagerToUpdateNav"
        label="Allow the manager to keep updating NAV"
      />
    </div>

    <FundNavMethodsTable
      v-model:methods="navMethods"
      class="nav_methods__table"
      deletable
      show-simulated-nav
      show-summary-row
      show-safe-contract-balance
      is-fund-non-init
      empty-text=""
      idx="nav/onboarding"
      :fund-chain-id="fundChainId"
      :loading="isFetchingNavMethods"
      :fund-address="fundSettings?.fundAddress"
      :safe-address="fundSettings?.safe"
      :base-symbol="fundSettings?.baseSymbol"
      :base-decimals="fundSettings?.baseDecimals"
      :safe-contract-base-token-balance="safeContractBaseTokenBalance"
      :fund-factory-contract-v2-used="fundFactoryContractV2Used"
    >
      <!--
        The way in, as on the permissions step. With nothing added it is the
        table's whole body — a tile that says what this step is for — and
        once something is, it steps back to a row under the last method,
        where the next one will appear.
      -->
      <template #add="{ empty }">
        <button
          type="button"
          class="nav_add"
          :class="{ 'nav_add--hero': empty }"
          @click="isAddDialogOpen = true"
        >
          <span class="nav_add__plus" aria-hidden="true">
            <Icon icon="material-symbols:add-rounded" />
          </span>
          <span class="nav_add__title">Add NAV method</span>
        </button>
      </template>
    </FundNavMethodsTable>

    <!--
      One modal, three views: the ways in, and the two forms a person can
      write a method with. The forms open in place, with the way back in
      the title, so the picker is never swapped for a second dialog.
    -->
    <UiConfirmDialog v-model="isAddDialogOpen" max-width="600px">
      <!-- Just the heading: the dialog's default puts an eyebrow over it,
           and the choices below need no introduction. -->
      <template #title>
        <div class="nav_pick__head">
          <button
            v-if="pickerView !== 'pick'"
            type="button"
            class="nav_pick__back"
            aria-label="Back to the ways to add a method"
            @click="pickerView = 'pick'"
          >
            <Icon icon="material-symbols:arrow-back" width="1.125rem" />
          </button>
          <h2 class="brand_modal__title nav_pick__title">
            {{ pickerTitle }}
          </h2>
        </div>
      </template>

      <div v-if="pickerView === 'pick'" class="nav_pick">
        <!-- First, the two ways to write a method by hand. -->
        <ul class="nav_pick__list">
          <li class="nav_pick__row">
            <button
              type="button"
              class="nav_pick__item"
              @click="openDefineNew"
            >
              <span class="nav_pick__glyph" aria-hidden="true">
                <Icon icon="material-symbols:edit-square-outline-rounded" />
              </span>
              <span class="nav_pick__item_text">
                <span class="nav_pick__item_name">Define new</span>
                <span class="nav_pick__item_meta">
                  Describe a position and how it is valued
                </span>
              </span>
              <Icon
                class="nav_pick__item_plus"
                icon="material-symbols:add-rounded"
                aria-hidden="true"
              />
            </button>
          </li>
          <li class="nav_pick__row">
            <button
              type="button"
              class="nav_pick__item"
              @click="openRaw"
            >
              <span class="nav_pick__glyph" aria-hidden="true">
                <Icon icon="material-symbols:code-rounded" />
              </span>
              <span class="nav_pick__item_text">
                <span class="nav_pick__item_name">Raw NAV methods</span>
                <span class="nav_pick__item_meta">
                  Paste NAV entries as exported from a vault
                </span>
              </span>
              <Icon
                class="nav_pick__item_plus"
                icon="material-symbols:add-rounded"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>

        <!-- The registry's valuation library: one row per protocol whose
             positions it knows how to value on this chain. -->
        <div v-if="valuationProtocols.length" class="nav_lib">
          <div class="nav_lib__head">
            <span class="nav_lib__eyebrow">Library</span>
            <span class="nav_lib__count">
              {{ filteredValuationProtocols.length }} of {{ valuationProtocols.length }}
            </span>
          </div>
          <div class="nav_lib__search">
            <Icon
              icon="material-symbols:search"
              width="1.125rem"
              class="nav_lib__search_icon"
            />
            <input
              v-model="libraryQuery"
              class="nav_lib__search_input"
              type="search"
              placeholder="Search protocols"
              aria-label="Search the valuation library"
            >
            <button
              v-if="libraryQuery"
              type="button"
              class="nav_lib__search_clear"
              @click="libraryQuery = ''"
            >
              Clear
            </button>
          </div>
          <ul v-if="filteredValuationProtocols.length" class="nav_lib__list">
            <li
              v-for="protocol in filteredValuationProtocols"
              :key="protocol.protocol"
              class="nav_lib__row"
            >
              <button
                type="button"
                class="nav_lib__item"
                :disabled="!valuationContext"
                @click="openProtocol(protocol)"
              >
                <OnboardingProtocolLogo
                  :protocol="protocol.protocol"
                  :label="protocol.label"
                />
                <span class="nav_lib__item_text">
                  <span class="nav_lib__item_name">{{ protocol.label }}</span>
                  <span class="nav_lib__item_meta">
                    {{ valuationMethodsLine(protocol) }}
                  </span>
                </span>
                <Icon
                  class="nav_lib__item_plus"
                  icon="material-symbols:add-rounded"
                  aria-hidden="true"
                />
              </button>
            </li>
          </ul>
          <p v-else class="nav_lib__lead">
            No protocol matches “{{ libraryQuery }}”.
          </p>
        </div>
      </div>

      <FundNavValuationLibrary
        v-else-if="pickerView === 'protocol' && selectedProtocol && valuationContext"
        :chain-id="fundChainId"
        :context="valuationContext"
        :protocol="selectedProtocol"
        :existing-methods="navMethods"
        @added-methods="addValuationMethods"
      />

      <FundNavNewMethod
        v-else-if="pickerView === 'define'"
        :fund-address="fundSettings?.fundAddress"
        :base-token-address="fundSettings?.baseToken"
        @new-nav-method-created="onNewNavMethodCreatedHandler"
      />

      <FundNavRawMethodsForm
        v-else
        :methods="navMethods"
        @added-methods="addRawMethods"
      />
    </UiConfirmDialog>

    <!--
      Storing can take two transactions. The dialog does not ask for them:
      the footer's button already did. It shows where they are, one row
      each, and the wallet opens for the second once the first is in.
    -->
    <UiConfirmDialog
      :model-value="isStoreDialogOpen"
      max-width="480px"
      :persistent="isStoring"
      @update:model-value="closeStoreDialog"
    >
      <template #title>
        <div class="nav_store__eyebrow">
          NAV methods
          <span class="nav_store__step">
            Step {{ storeStepNumber }} of {{ storeSteps.length }}
          </span>
        </div>
        <h2 class="brand_modal__title nav_store__title">
          Store NAV methods
        </h2>
      </template>

      <OnboardingTransactionSteps :steps="storeSteps" />

      <div class="nav_store__foot">
        <template v-if="isStoreDone">
          <div class="nav_store__done">
            <Icon
              icon="material-symbols:check"
              class="nav_store__done_icon"
              height="1rem"
              width="1rem"
            />
            <span>{{ storeDoneText }}</span>
          </div>
          <v-btn class="nav_store__button bg-primary text-secondary" @click="closeStoreDialog(false)">
            Close
          </v-btn>
        </template>
        <template v-else-if="storeError">
          <p class="nav_store__error">
            {{ storeError }}
          </p>
          <v-btn class="nav_store__button bg-primary text-secondary" @click="runStoreFlow">
            Try again
          </v-btn>
        </template>
        <p v-else class="nav_store__note">
          {{ storeNote }}
        </p>
      </div>
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ERC20 } from "~/assets/contracts/ERC20";
import {
  encodeUpdateNavMethods,
  getAllowManagerToUpdateNavPermissionsData,
} from "~/composables/nav/navProposal";
import {
  isValuationContextReady,
  listValuationLibrary,
} from "~/composables/nav/valuationRegistry";
import type {
  IValuationProtocolView,
  IValuationVaultContext,
} from "~/composables/nav/valuationRegistry";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { getNAVData } from "~/store/fund/actions/fetchFundNAVData.action";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type INAVMethod from "~/types/nav_method";
import { managerCanExecuteNavUpdate } from "~/composables/nav/managerNavPermission";
import { detectRolesVersion } from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { RolesVersion } from "~/types/enums/roles_version";
import type { ITransactionStep } from "~/components/onboarding/TransactionSteps.vue";

const createFundStore = useCreateFundStore();
const toastStore = useToastStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();

const { fundChainId, fundInitCache, fundSettings, fundFactoryContractV2Used } = storeToRefs(createFundStore);

// Data
const isFetchingNavMethods = ref(false);
const isAddDialogOpen = ref(false)
const navMethods = ref<INAVMethod[]>([]);
const allowManagerToUpdateNav = ref(true);
const safeContractBaseTokenBalance = ref(0);

/**
 * Computed
 */
const fundFactoryContract = computed(() => {
  const chainContracts = web3Store.chainContracts[fundChainId.value];
  return fundFactoryContractV2Used.value ? chainContracts?.fundFactoryContractV2 : chainContracts?.fundFactoryContract
})

/** Which view the add modal shows: the ways in, a protocol, or one of the two forms. */
type PickerView = "pick" | "protocol" | "define" | "raw";
const pickerView = ref<PickerView>("pick");
const selectedProtocol = ref<IValuationProtocolView | null>(null);

/**
 * What the registry's generators need to know about this vault. Null
 * until the factory has cached the fund's addresses — the protocol rows
 * stay listed but disabled until then.
 */
const valuationContext = computed((): IValuationVaultContext | null => {
  const candidate = {
    safe: fundSettings.value?.safe ?? "",
    fund: fundSettings.value?.fundAddress ?? "",
    baseToken: {
      address: fundSettings.value?.baseToken ?? "",
      decimals: fundSettings.value?.baseDecimals ?? 18,
      symbol: fundSettings.value?.baseSymbol ?? "",
    },
  };
  return isValuationContextReady(candidate) ? candidate : null;
});

/** The registry's valuation library for this chain (see VALUATION.md there). */
const valuationProtocols = computed((): IValuationProtocolView[] => {
  try {
    return listValuationLibrary(fundChainId.value, valuationContext.value);
  } catch (error) {
    console.error("valuation library unavailable", error);
    return [];
  }
});

/** The library search, cleared with the dialog. */
const libraryQuery = ref("");

/**
 * The library narrowed to the search: by name, by registry key, or by a
 * method it offers — "borrowed" finds every lending protocol.
 */
const filteredValuationProtocols = computed((): IValuationProtocolView[] => {
  const needle = libraryQuery.value.trim().toLowerCase();
  if (!needle) return valuationProtocols.value;
  return valuationProtocols.value.filter((protocol) =>
    [protocol.label, protocol.protocol, ...protocol.methods.map((m) => m.label)]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
});

/** What a protocol's methods cover, for the library row. */
const valuationMethodsLine = (protocol: IValuationProtocolView): string =>
  protocol.methods.map((m) => m.label.toLowerCase()).join(" · ");

const pickerTitle = computed((): string => {
  if (pickerView.value === "protocol") return selectedProtocol.value?.label ?? "Protocol";
  if (pickerView.value === "define") return "Define new method";
  if (pickerView.value === "raw") return "Raw NAV methods";
  return "Add NAV method";
});

// The modal always opens on the ways in, whatever view it closed on.
watch(isAddDialogOpen, (open) => {
  if (open) pickerView.value = "pick";
  else libraryQuery.value = "";
});

/**
 * Methods
 */

/* ---- Storing --------------------------------------------------------------- */

// The transactions a save takes, as the dialog's rail shows them: storing the
// methods, and, with the switch above on, letting the manager keep updating
// NAV. Each is sent on its own; the second only once the first is in.
const storeSteps = ref<ITransactionStep[]>([]);
const isStoreDialogOpen = ref(false);
const isStoring = ref(false);
// The moment between the click and the rail: the permission check below.
const isPreparingStore = ref(false);
const storeError = ref("");

/* ---- Is the second transaction needed at all? ------------------------------ */

/**
 * The manager's NAV permission names the vault and the chain's NAV executor,
 * nothing about the methods stored here, so it can be granted before any NAV
 * exists, and the Permissions step's "Update NAV" switch usually has. Whether
 * the role holds it is asked of the modifier itself (a dry-run from the
 * connected wallet); "not proven" answers false and the grant is sent, which
 * costs a transaction but never leaves the manager unable to update NAV.
 */
const resolveNavPermission = async (): Promise<{ held: boolean; calldatas: string[] }> => {
  const fundAddress = fundSettings?.value?.fundAddress;
  const rolesModifier = fundInitCache?.value?.rolesModifier;
  if (!fundAddress || !rolesModifier) return { held: false, calldatas: [] };

  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
  // Probed on the modifier itself; the factory the vault was created with
  // only says which generation to expect when no RPC answers the probe.
  const rolesVersion = await detectRolesVersion(
    fundChainId.value,
    rolesModifier,
    fundFactoryContractV2Used.value ? RolesVersion.V2 : RolesVersion.V1,
  );
  const held = await managerCanExecuteNavUpdate(
    fundChainId.value,
    rolesModifier,
    fundAddress,
    getNAVExecutorBeaconProxyAddress(fundChainId.value),
    rolesVersion,
  );
  return {
    held,
    // Encoded for the modifier generation this vault has: a Roles V2
    // modifier does not have the V1 calls.
    calldatas: held
      ? []
      : getAllowManagerToUpdateNavPermissionsData(
        fundAddress,
        fundChainId.value,
        rolesModifier,
        rolesVersion,
      ).calldatas,
  };
};

// Asked when the step opens (and when the wallet changes), so the switch is
// only offered while there is something for it to decide.
const isNavPermissionHeld = ref(false);
// The grant's calls, as resolved when the rail opened.
let navPermissionCalldatas: string[] = [];
watch(
  () => [
    fundSettings?.value?.fundAddress,
    fundInitCache?.value?.rolesModifier,
    accountStore.activeAccountAddress,
  ],
  async () => {
    try {
      isNavPermissionHeld.value = (await resolveNavPermission()).held;
    } catch (error) {
      console.warn("Could not check the manager's NAV permission", error);
      isNavPermissionHeld.value = false;
    }
  },
  { immediate: true },
);

const isStoreDone = computed(
  () => storeSteps.value.length > 0 && storeSteps.value.every((step) => step.state === "done"),
);
/** The step the flow is on: the first one that is not done, or the last. */
const storeStepNumber = computed(() => {
  const index = storeSteps.value.findIndex((step) => step.state !== "done");
  return index === -1 ? storeSteps.value.length : index + 1;
});
const storeNote = computed(() => {
  const live = storeSteps.value[storeStepNumber.value - 1];
  if (live?.state === "confirming") return "Sent. Waiting for it to be confirmed.";
  if (storeSteps.value.length > 1) return "Confirm each transaction in your wallet as it opens.";
  return isNavPermissionHeld.value
    ? "Confirm the transaction in your wallet. The manager can already update NAV, so one transaction is all it takes."
    : "Confirm the transaction in your wallet.";
});
const storeDoneText = computed(() => {
  if (storeSteps.value.length > 1) return "NAV methods stored, and the manager can keep updating NAV.";
  return isNavPermissionHeld.value
    ? "NAV methods stored. The manager can already update NAV."
    : "NAV methods stored.";
});

const closeStoreDialog = (open: boolean) => {
  // The wallet may still be asking: the rail stays up until it has an answer.
  if (open || isStoring.value) return;
  isStoreDialogOpen.value = false;
};

const setStepState = (index: number, state: ITransactionStep["state"]) => {
  storeSteps.value = storeSteps.value.map((step, i) =>
    i === index ? { ...step, state } : step,
  );
};

/** What went wrong, in a line a person can act on. */
const describeSendError = (error: any): string => {
  const message = String(error?.message ?? error ?? "");
  if (error?.code === 4001 || /user (rejected|denied)/i.test(message)) {
    return "The transaction was rejected in the wallet.";
  }
  return message || "The transaction failed.";
};

/**
 * Send one factory transaction and wait for it to be mined. Resolves on a
 * successful receipt; rejects when the wallet refuses, the send fails or the
 * transaction reverts.
 */
const sendAndConfirm = (method: string, args: any[], onSubmitted: () => void) =>
  new Promise<void>((resolve, reject) => {
    try {
      fundFactoryContract.value
        .send(method, {}, ...args)
        .on("transactionHash", (hash: any) => {
          console.log("tx hash: " + hash);
          onSubmitted();
        })
        .on("receipt", (receipt: any) => {
          console.log("receipt: ", receipt);
          if (receipt.status) resolve();
          else reject(new Error("The transaction reverted."));
        })
        .on("error", (error: any) => reject(error))
        // The same failure also rejects the promise side of the event.
        .catch((error: any) => reject(error));
    } catch (error) {
      reject(error);
    }
  });

/**
 * The footer's button: check there is something to store, find out whether
 * the permission still has to be granted, then open the rail with the
 * transactions that will actually be sent.
 */
const handleClickStoreNavMethods = async () => {
  if (isStoring.value || isPreparingStore.value) return;
  if (navMethods.value.length === 0) {
    return toastStore.warningToast("No methods to store.");
  }
  if (!fundSettings?.value?.fundAddress) {
    return toastStore.errorToast("Fund address is missing.");
  }

  let grantsPermission = false;
  if (allowManagerToUpdateNav.value) {
    if (!fundInitCache?.value?.rolesModifier) {
      return toastStore.errorToast("Roles modifier address is missing.");
    }
    // Decided before the first transaction, so the rail only shows a second
    // one when there will be one. Storing the methods does not change what
    // the manager's role is allowed to do.
    isPreparingStore.value = true;
    try {
      const permission = await resolveNavPermission();
      isNavPermissionHeld.value = permission.held;
      navPermissionCalldatas = permission.calldatas;
      grantsPermission = !permission.held;
    } catch (error: any) {
      console.error("Failed preparing the manager's NAV permission ", error);
      return toastStore.errorToast(
        "Failed preparing the manager's NAV permission, " + error.message,
      );
    } finally {
      isPreparingStore.value = false;
    }
  }

  storeSteps.value = [
    { label: "Store the NAV methods", state: "waiting" },
    ...(grantsPermission
      ? [{ label: "Allow the manager to keep updating NAV", state: "waiting" as const }]
      : []),
  ];
  isStoreDialogOpen.value = true;
  runStoreFlow();
};

/**
 * Runs the steps in order, from the first that is not done, so "Try again"
 * after a failed second transaction does not store the methods twice.
 */
const runStoreFlow = async () => {
  if (isStoring.value) return;
  isStoring.value = true;
  storeError.value = "";

  const transactions: (() => [string, any[]])[] = [
    () => {
      const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
      // storeNAV(address navExecutorAddr, bytes calldata data)
      return [
        "storeNAV",
        [
          getNAVExecutorBeaconProxyAddress(fundChainId.value),
          encodeUpdateNavMethods(navMethods.value, fundSettings?.value?.baseDecimals),
        ],
      ];
    },
    () => ["submitPermissions", [navPermissionCalldatas]],
  ];

  for (let index = 0; index < storeSteps.value.length; index++) {
    if (storeSteps.value[index].state === "done") continue;
    setStepState(index, "wallet");
    try {
      const [method, args] = transactions[index]();
      console.log(method, JSON.stringify(args, null, 2));
      await sendAndConfirm(method, args, () => setStepState(index, "confirming"));
      setStepState(index, "done");
    } catch (error: any) {
      console.error(`Failed: ${storeSteps.value[index].label}`, error);
      setStepState(index, "failed");
      storeError.value = describeSendError(error);
      break;
    }
  }
  isStoring.value = false;
};

const onNewNavMethodCreatedHandler = (navMethod: INAVMethod) => {
  // Add newly defined NAV entry to fund managed methods.
  navMethods.value.push(navMethod);

  // The method is on the table now; the modal has done its job.
  isAddDialogOpen.value = false;
  console.log("new", navMethods.value);

  toastStore.addToast("Method added successfully.")
}

// The picker turns into the form that was chosen, in the same modal.
const openDefineNew = () => {
  pickerView.value = "define";
};
const openRaw = () => {
  pickerView.value = "raw";
};
const openProtocol = (protocol: IValuationProtocolView) => {
  selectedProtocol.value = protocol;
  pickerView.value = "protocol";
};

const addValuationMethods = (methods: INAVMethod[]) => {
  navMethods.value = [...navMethods.value, ...methods];
  isAddDialogOpen.value = false;
  toastStore.addToast(
    methods.length === 1 ? "Method added successfully." : "Methods added successfully.",
  );
};

const addRawMethods = (newMethods: INAVMethod[]) => {
  navMethods.value = [
    ...navMethods.value,
    ...newMethods,
  ];
  isAddDialogOpen.value = false;
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
  isStoring: computed(() => isStoring.value || isPreparingStore.value),
});
</script>

<style scoped lang="scss">
/* The design's NAV step: the title, the manager toggle in a hairline row
   under it, then the table in its own frame. Adding happens from inside the
   table, the way the permissions step adds a protocol from inside its card. */
.nav_methods {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.3;
    color: $color-white;
  }

  /* Both panels take the flow's panel fill, so they sit like the fee rows
     and the permissions cards rather than as bare frames. */
  &__toggle_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 14px 20px;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
  }

  &__table {
    background: $color-card-background;
  }

  /* In the switch's place once there is nothing left for it to decide. */
  &__toggle_state {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    flex: none;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
    white-space: nowrap;
  }

  &__toggle_text {
    font-size: 13.5px;
    line-height: 1.5;
    color: $color-text-irrelevant;
  }
}

/* The tile, drawn like the permissions card's: dashed, like every other
   "put something here" surface in the flow, with a cyan-tinted plus and a
   mono label. Hero-sized while it is all the table body holds. */
.nav_add {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px dashed $color-line-2;
  border-radius: $default-border-radius;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    border-color $default-transition-time ease,
    background-color $default-transition-time ease;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: $color-cyan-line;
    background: $color-gray-light-transparent;

    .nav_add__title {
      color: $color-white;
    }
  }

  &--hero {
    flex-direction: column;
    justify-content: center;
    gap: 1rem;
    padding: 2.5rem 1.5rem;
    text-align: center;
  }

  &__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: $color-cyan-tint;
    font-size: 16px;
    color: $color-cyan;
  }

  &--hero &__plus {
    width: 56px;
    height: 56px;
    font-size: 32px;
  }

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    transition: color $default-transition-time ease;
  }

  &--hero &__title {
    font-size: 12px;
  }
}

/* The picker: two hand-written ways in as a short list, then the library
   under its own eyebrow. Rows are set like the permissions library's. */
.nav_pick {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  /* The title row: the way back, when a form is open, then the heading. */
  &__head {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  /* The modal's title expects an eyebrow above it; without one, the gap
     it leaves for that would just be a title sitting low in its head. */
  &__title {
    margin-top: 0;
  }

  /* Sized like the modal's close target, so the two ends of the head row
     match; it steps a form back to the ways in. */
  &__back {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    margin-left: -0.5rem;
    border: none;
    border-radius: $default-border-radius;
    background: none;
    color: $color-steel-blue;
    cursor: pointer;
    transition: background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
      color: $color-white;
    }
  }

  /* Two separate cards a gap apart, not one list with an inner divider —
     the same rhythm the Add-protocol modal gives Zodiac and Raw
     permissions, so the two pickers read as one family. */
  &__list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__row {
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    /* The row's hover fill would otherwise square off the corners. */
    overflow: hidden;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 0.875rem;
    border: none;
    background: none;
    text-align: left;
    color: $color-white;
    cursor: pointer;
    transition: background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
    }
  }

  /* The row's mark: the disc a protocol's logo would fill, with a glyph
     instead, since a way of writing a method has no logo. */
  &__glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 1px solid $color-line-2;
    border-radius: 999px;
    font-size: 15px;
    color: $color-cyan;
  }

  &__item_text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  &__item_name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  &__item_meta {
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.4;
    color: $color-steel-blue;
  }

  &__item_plus {
    flex: none;
    font-size: 18px;
    color: $color-steel-blue;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  &__section_head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__count {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }
}

/* The store dialog: the eyebrow carries the position in the flow, the way the
   deposit dialog's does; the rail under it is OnboardingTransactionSteps. */
.nav_store {
  &__eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__step {
    padding: 0.0625rem 0.375rem;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: $color-text-irrelevant;
  }

  &__title {
    margin-top: 0.375rem;
  }

  &__foot {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    margin-top: 1.75rem;
  }

  &__note {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__error {
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-neg;
    word-break: break-word;
  }

  &__button {
    width: 100%;
    min-height: 2.75rem;
    font-weight: 600;
  }

  /* The outcome, in the accent the finished steps above it are using. */
  &__done {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid $color-accent-line;
    border-radius: $default-border-radius;
    background: $color-accent-soft;
    font-size: $text-sm;
    line-height: 1.5;
    color: $color-light-subtitle;
  }

  &__done_icon {
    flex: none;
    margin-top: 0.125rem;
    color: $color-cyan;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav_add,
  .nav_add__title,
  .nav_pick__item,
  .nav_pick__back {
    transition: none;
  }
}

/* The valuation library, set exactly like the permissions modal's
   protocol library (ProtocolPermissions.vue .library): eyebrow + "n of n",
   a search field, one bordered list with divider rows. */
.nav_lib {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__eyebrow {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__count {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }

  &__lead {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;

    &:focus-within {
      border-color: $color-accent-line;
    }
  }

  &__search_icon {
    flex: none;
    color: $color-steel-blue;
  }

  /* The app's global input rule sets a height and padding on every bare
     input, so all three are set here rather than only the one. */
  &__search_input {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 2.25rem;
    padding: 0;
    border: none;
    background: transparent;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.3;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }

    &:focus {
      outline: none;
    }

    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  &__search_clear {
    flex: none;
    border: none;
    background: none;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    cursor: pointer;

    &:hover {
      color: $color-white;
    }
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
  }

  &__row + &__row {
    border-top: 1px solid $color-line;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 0.875rem;
    border: none;
    background: none;
    text-align: left;
    color: $color-white;
    cursor: pointer;
    transition: background-color $default-transition-time ease;

    &:hover:not(:disabled),
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
    }

    &:disabled {
      cursor: default;
      opacity: 0.55;
    }
  }

  &__item_text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  &__item_name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  &__item_meta {
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.4;
    color: $color-steel-blue;
  }

  &__item_plus {
    flex: none;
    font-size: 18px;
    color: $color-steel-blue;
  }
}
</style>
