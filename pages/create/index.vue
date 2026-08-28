<template>
  <div class="create page_shell">
    <OnboardingPasswordProtect
      v-if="!isCreateFundPasswordCorrect"
      v-model:is-password-correct="isCreateFundPasswordCorrect"
    />

    <template v-else>
      <header class="create__header">
        <h1 class="create__title">
          Launch a vault
        </h1>
        <div class="create__header_actions">
          <!-- The workspace switcher, not a vault setting: it chooses which
               chain's draft or deployed vault is on screen. Stays enabled after
               initialization, where the Basics field is locked — otherwise a
               curator with a live vault on one chain could never start one on
               another. -->
          <OnboardingSelectMenu
            class="create__chain_select"
            :model-value="selectedChainId"
            :options="chainOptions"
            @update:model-value="(value: any) => onChainSelected(value)"
          >
            <template #trigger="{ option }">
              <IconChain :chain-id="(option?.value as ChainId)" :size="18" />
              <span>{{ option?.label ?? selectedChainName }}</span>
            </template>
            <template #option="{ option }">
              <IconChain :chain-id="(option.value as ChainId)" :size="20" />
              <span class="create__chain_option">{{ option.label }}</span>
              <!-- Drafts are per chain, so without this the only way to find
                   one is to switch to every network and look. -->
              <span v-if="option.hasDraft" class="create__chain_draft">Draft</span>
            </template>
          </OnboardingSelectMenu>
          <!-- Reports rather than acts. The draft is written on every change,
               and a Save button beside it would imply it was not. -->
          <span
            v-if="!isFundInitialized && hasDraftContent"
            class="create__saved"
          >
            {{ isSavingDraft ? "Saving…" : "Draft saved" }}
          </span>
        </div>
      </header>

      <OnboardingStepper
        :steps="stepperEntry"
        :current="step"
        :max-reached="maxStepUnlocked"
        :chain-id="selectedChainId"
        @select="goToStep"
      />

      <div v-if="isFundInitialized" class="create__banner">
        <span class="create__banner_badge">Initialized</span>
        <span>
          Vault has been initialized already and cannot be edited. You can add
          permissions &amp; NAV methods and finalize vault creation.
        </span>
      </div>

      <div class="create__card">
        <div v-if="!accountStore.isConnected" class="create__gate">
          <p>In order to create a vault, you need to connect your wallet.</p>
          <v-btn class="bg-primary text-white" @click="accountStore.connectWallet()">
            Connect wallet
          </v-btn>
        </div>

        <div
          v-else
          class="create__body"
          :class="{ 'create__body--locked': isStepReadOnly }"
        >
          <OnboardingBasics
            v-if="currentStepKey === OnboardingStep.Basics"
            :fields="currentStepFields"
            :chain-id="selectedChainId"
            :is-disabled="isStepReadOnly"
            @update:chain-id="onChainSelected"
            @delete-row="(field: IField) => deleteCustomFieldRow(field, OnboardingStep.Basics)"
            @add-custom-field="(field: IField) => addCustomFieldRow(field, OnboardingStep.Basics)"
          />

          <OnboardingFee
            v-else-if="currentStepKey === OnboardingStep.Fee"
            :groups="currentStepFields as any"
            :is-disabled="isStepReadOnly"
          />

          <OnboardingWhitelist
            v-else-if="currentStepKey === OnboardingStep.Whitelist"
            v-model="whitelistedAddresses"
            v-model:whitelist-enabled="isWhitelistedDeposits"
            :is-editable="!isStepReadOnly"
          />

          <OnboardingGovernance
            v-else-if="currentStepKey === OnboardingStep.Governance"
            :fields="currentStepFields"
            :vault-symbol="vaultSymbol"
            :chain-id="selectedChainId"
            :is-disabled="isStepReadOnly"
          />

          <OnboardingPermissions
            v-else-if="currentStepKey === OnboardingStep.Permissions"
            ref="permissionsRef"
          />

          <OnboardingNavMethods
            v-else-if="currentStepKey === OnboardingStep.NavMethods"
            ref="navMethodsRef"
            :chain-id="fundChainId"
            :fund-settings="fundSettings"
          />

          <OnboardingFinalize
            v-else-if="currentStepKey === OnboardingStep.Finalize"
            ref="finalizeRef"
            :fund-chain-id="fundChainId"
          />
        </div>
      </div>

      <div class="create__footer">
        <div class="create__footer_side">
          <button
            v-if="step > 1"
            type="button"
            class="create__ghost"
            @click="step--"
          >
            &#8592; Back
          </button>
          <button
            v-if="!isFundInitialized && accountStore.isConnected"
            type="button"
            class="create__ghost create__ghost--danger"
            @click="isClearCacheDialogOpen = true"
          >
            Clear draft
          </button>
        </div>

        <div class="create__footer_side create__footer_side--end">
          <!-- Nothing to list while the body shows the wallet gate: the form
               those errors belong to is not on screen yet. -->
          <ul
            v-if="validationErrors.length && accountStore.isConnected"
            class="create__errors"
          >
            <li v-for="(error, index) in validationErrors" :key="index">
              {{ error }}
            </li>
          </ul>

          <div v-if="showRolesToggle" class="create__roles">
            <OnboardingToggle
              v-model="rolesToggleValue"
              :disabled="isFundInitialized"
              label="Use legacy Roles V1"
            />
            <span class="create__roles_label">Use legacy Roles V1</span>
          </div>

          <button
            v-if="showSkipButton"
            type="button"
            class="create__ghost"
            @click="goToNextStep"
          >
            Next
          </button>

          <v-btn
            v-if="primaryAction"
            class="create__primary bg-primary text-white"
            :class="{ 'create__primary--off': !primaryAction.enabled }"
            :loading="primaryAction.loading"
            @click="primaryAction.run"
          >
            {{ primaryAction.label }}
          </v-btn>
        </div>
      </div>

      <v-dialog
        :model-value="isCheckingIfFundInitCacheExists"
        max-width="360px"
        persistent
        @update:model-value="isCheckingIfFundInitCacheExists = false"
      >
        <div class="brand_modal brand_modal--bare">
          <div class="brand_modal__body">
            <v-progress-circular size="18" width="2" indeterminate />
            Loading vault init cache…
          </div>
        </div>
      </v-dialog>

      <!-- The last screen before the vault and its governor are deployed, so it
           is a review rather than a warning: the values that stop being
           editable are printed with what they are about to be set to. -->
      <UiConfirmDialog
        v-model="isInitializeDialogOpen"
        eyebrow="Initialize vault"
        title="These settings are permanent"
        confirm-text="Initialize"
        cancel-text="Go back"
        class="confirm_dialog"
        max-width="560px"
        :loading="isInitializeLoading"
        @confirm="initializeFund"
        @cancel="isInitializeDialogOpen = false"
      >
        <section
          v-for="group in immutableSummary"
          :key="group.title"
          class="init_review__group"
        >
          <div class="init_review__group_title">
            {{ group.title }}
          </div>
          <dl class="init_review__rows">
            <div
              v-for="row in group.rows"
              :key="row.label"
              class="init_review__row"
            >
              <dt class="init_review__label">
                {{ row.label }}
              </dt>
              <dd class="init_review__value">
                <span :class="{ 'init_review__value--empty': !row.value }">
                  {{ row.value || "Not set" }}
                </span>
                <span v-if="row.note" class="init_review__note">{{ row.note }}</span>
              </dd>
            </div>
          </dl>
        </section>
      </UiConfirmDialog>

      <UiConfirmDialog
        v-model="isClearCacheDialogOpen"
        title="Heads up"
        confirm-text="Clear"
        cancel-text="Don't clear"
        class="confirm_dialog"
        max-width="520px"
        :message="clearCacheMessage"
        @confirm="handleClearCache"
        @cancel="isClearCacheDialogOpen = false"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import debounce from "lodash.debounce";
import { truncateAddressEllipsis } from "~/composables/addressUtils";
import {
  formatApproximateDuration,
  fromBpsToPercentage,
} from "~/composables/formatters";
import { useAccountStore } from "~/store/account/account.store";
import { fetchBaseTokenDetails } from "~/store/create-fund/actions/fetchFundInitCache.action";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";
import { networkChoices, networks, networksMap } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ChainId } from "~/types/enums/chain_id";
import { feeFieldKeys, type IWhitelist } from "~/types/enums/fund_setting_proposal";
import type { IField, IFieldGroup } from "~/types/enums/input_type";
import { InputType } from "~/types/enums/input_type";
import {
  OnboardingFieldsMap,
  OnboardingStep,
  OnboardingStepMap,
  type IOnboardingStep,
  type OnboardingInitializingSteps,
} from "~/types/enums/stepper_onboarding";
import type IFundSettings from "~/types/fund_settings";
import type IFundInitCache from "~/types/fund_init_cache";
const toastStore = useToastStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();
const createFundStore = useCreateFundStore();
const blockTimeStore = useBlockTimeStore();

// Data
const {
  fundChainId,
  onboardingWhitelistLocalStorageKey,
  onboardingStepperEntryLocalStorageKey,
} = storeToRefs(createFundStore);
const step = ref(1);
/** The furthest step reached; everything up to it stays clickable on the rail. */
const maxStepReached = ref(1);

const isInitializeDialogOpen = ref(false);
const isInitializeLoading = ref(false);
const isClearCacheDialogOpen = ref(false);
/**
 * Roles V2 is what a new vault gets; the toggle is the way back to V1, not the
 * way in to V2. Kept as an opt-out so the older modifier stays reachable for a
 * curator who needs to match an existing setup, and off by default so nobody
 * launches on it by not noticing a switch.
 */
const useLegacyRolesV1 = ref(false);
// If user already authenticated before set isCreateFundPasswordCorrect to true.
const isCreateFundPasswordCorrect = ref<boolean>(
  getLocalStorageItem("isCreateFundPasswordCorrect", false),
);

const permissionsRef = ref<any>(null);
const navMethodsRef = ref<any>(null);
const finalizeRef = ref<any>(null);

// whitelist data
const whitelistedAddresses = ref<IWhitelist[]>([]);
const isCheckingIfFundInitCacheExists = ref(false);
const isWhitelistedDeposits = ref(false);
const selectedChainId = ref<ChainId>(networkChoices[0].value);

// We want to set fundInitCache here when it is updated and not take it
// from the store to prevent race conditions.
const fundInitCache = ref<IFundInitCache | undefined>(undefined);
const fundSettings = computed<IFundSettings>(() => fundInitCache?.value?.fundSettings || {} as IFundSettings);
const fundMetadata = computed(() => fundInitCache?.value?.fundMetadata || {});
const fundGovernorData = computed(() => fundInitCache?.value?.governorData || {});

// Fetch Fund Cache and fill the form data with the fetched fund cache.
const setFieldValue = (field: IField) => {
  if ([
    InputType.ReadonlyJSON,
    InputType.Date,
  ].includes(field.type)) {
    field.type = InputType.Text;
  }
  field.isToggleable = false;

  const fieldKey = field.key as string;
  // Convert some fields to text fields, as they are all readonly.
  let cachedValue;

  if (fieldKey in fundSettings.value) {
    cachedValue = fundSettings.value[fieldKey];
    if (feeFieldKeys.includes(fieldKey)) {
      cachedValue = Number(fromBpsToPercentage(cachedValue));
    }

    field.value = cachedValue;
  } else if (fieldKey in fundMetadata.value) {
    cachedValue = fundMetadata.value[fieldKey];
    field.value = cachedValue;
  } else if (fieldKey in fundGovernorData.value) {
    cachedValue = fundGovernorData.value[fieldKey];
    field.value = cachedValue;
  } else if (fundInitCache?.value) {
    console.error(" field key missing", field);
  }
  return cachedValue
}
const fetchFundInitCache = async () => {
  if (!selectedChainId.value) return;

  if (accountStore.activeAccountAddress) {

    // Take stepper entry chain id from the local storage
    fundInitCache.value = await createFundStore.fetchFundInitCache(
      selectedChainId.value,
      accountStore.activeAccountAddress,
    );

    for (const step of stepperEntry.value) {
      for (const field of step.fields || []) {
        if ("fields" in field) {
          // Field is of type IFieldGroup, has more subfields.
          // TODO here we only go 2 levels deep, but IField can have infinite levels, do recursion for fields.
          let hasValue;
          for (const subField of field.fields || []) {
            const val = setFieldValue(subField);
            // This feels like a hack, but we are trying to enable the toggle button for those that are not 0 or 0x0...
            // But it won't handle cases where users want the address to be 0x0.
            if (!hasValue && val != null && val !== ethers.ZeroAddress && val !== 0) {
              hasValue = true;
            }
          }
          if (field?.isToggleable && hasValue) {
            field.isToggleOn = true;
          }
        } else {
          // Field is a normal field.
          setFieldValue(field);
        }
      }
    }

    // Set Whitelisted addresses
    whitelistedAddresses.value = (fundInitCache?.value?.fundSettings?.allowedDepositAddrs || []).map(
      (address: string) => (
        {
          address,
          deleted: false,
          isNew: false,
        } as IWhitelist
      ),
    )
    isWhitelistedDeposits.value = fundInitCache?.value?.fundSettings?.isWhitelistedDeposits || false;

    // An initialized vault is no longer a draft: what is on screen now comes
    // from the chain, so the stored copy is stale and would only reappear as a
    // ghost of the form on the next visit.
    if (fundInitCache?.value) {
      createFundStore.clearFundLocalStorage();
      refreshChainDrafts();
    }
  } else {
    createFundStore.clearFundInitCache();
  }
}

const selectedChainName = computed(
  () => networksMap[selectedChainId.value]?.chainName ?? selectedChainId.value,
);

const clearCacheMessage = computed(
  () =>
    `Are you sure you want to clear the draft for <strong>${selectedChainName.value}</strong>? ` +
    "This clears the create vault form data for the selected chain and you lose everything entered so far.",
);

const deleteCustomFieldRow = (field: IField, stepKey: string) => {
  try{
    const stepIndex = stepperEntry.value.findIndex(
      (step) => step.key === stepKey,
    );

    if (stepIndex !== -1) {
      const fieldIndex = stepperEntry.value[stepIndex].fields?.findIndex(
        (f) => f.key === field.key,
      ) ?? -1;

      if (fieldIndex !== -1) {
        stepperEntry.value[stepIndex].fields?.splice(fieldIndex, 1);
      }
    }
  }
  catch (error) {
    console.error("Error deleting custom field", error);
    toastStore.errorToast("Error deleting custom field");
  }
};

const addCustomFieldRow = (customField: IField, stepKey: string) => {
  try {
    const stepIndex = stepperEntry.value.findIndex(
      (step) => step.key === stepKey,
    );

    // check if this key already exists
    if (stepIndex !== -1) {
      const fieldIndex = stepperEntry.value[stepIndex].fields?.findIndex(
        (f) => f.key === customField.key,
      );

      if (fieldIndex !== -1) {
        return toastStore.errorToast("Custom field with this name already exists");
      }

      stepperEntry.value[stepIndex].fields?.push(customField);
    }
  } catch (error) {
    console.error("Error adding custom field", error);
    toastStore.errorToast("Error adding custom field");
  }

};

const goToNextStep = () => {
  // Same ceiling the rail obeys, so no path forward — the Next button or a
  // click on the rail — lands on a step that needs a vault before there is one.
  step.value = Math.min(step.value + 1, lastReachableStep.value);
}

/**
 * The rail offers every step already reached, not only those before the
 * current one — stepping back to check something written on Basics should not
 * cost four clicks to undo.
 */
const goToStep = (target: number) => {
  if (target > maxStepUnlocked.value) return;
  step.value = target;
};

/**
 * Which chains currently hold a draft. Read out of local storage and refreshed
 * on every write rather than kept in lockstep with it, which is enough for a
 * list that only has to be right when the dropdown is looked at.
 */
const chainsWithDrafts = ref<ChainId[]>([]);

const refreshChainDrafts = () => {
  chainsWithDrafts.value = getChainDrafts()
    .filter((chain) => chain.hasDrafts)
    .map((chain) => chain.chainId);
};

const chainOptions = computed(() =>
  networks.map((network) => ({
    value: network.chainId,
    label: network.chainName,
    hasDraft: chainsWithDrafts.value.includes(network.chainId),
  })),
);

/**
 * Is there anything on this chain worth keeping? Guards the autosave below:
 * writing a pristine form to local storage would make setDefaultSelectedChainId
 * treat the chain as having work in progress and open there next time, and
 * would put a Draft marker on a network nothing was ever typed for.
 */
const hasDraftContent = computed(() =>
  whitelistedAddresses.value.length > 0 ||
  stepperEntry.value.some((entry) =>
    (entry.fields ?? []).some((field) => {
      if (field.fields) return !!field.isToggleOn;
      return field.value !== undefined && field.value !== null && field.value !== "";
    }),
  ),
);

/** True between a change and the moment it reaches local storage. */
const isSavingDraft = ref(false);

/**
 * Autosave. A form this long should not make keeping your work an explicit act
 * — least of all through a dialog on the way out, which asks a question whose
 * answer is always yes.
 *
 * Debounced because every keystroke lands here.
 */
const autoSaveDraft = debounce(() => {
  isSavingDraft.value = false;
  if (isFundInitialized.value || !hasDraftContent.value) return;

  writeDraftToLocalStorage();
  refreshChainDrafts();
}, 600);

/** Writes immediately and drops any pending debounce, for moments with no 600ms to spare. */
const flushDraft = () => {
  autoSaveDraft.cancel();
  isSavingDraft.value = false;
  if (isFundInitialized.value || !hasDraftContent.value) return;

  writeDraftToLocalStorage();
  refreshChainDrafts();
};

const onChainSelected = (chainId: ChainId) => {
  if (chainId === selectedChainId.value) return;

  // Each chain keeps its own workspace, so what has been typed for the one being
  // left is written on the way out. Flushed rather than left to the debounce:
  // the pending save would otherwise land after the switch and file this chain's
  // work under the next chain's key.
  flushDraft();

  selectedChainId.value = chainId;
};

const handleClearCache = () => {
  try {
    // Before the reset, or the pending save would put back what was cleared.
    autoSaveDraft.cancel();
    isSavingDraft.value = false;

    createFundStore.clearFundLocalStorage();
    stepperEntry.value = initStepperEntry();
    // The whitelist is stored alongside the form and has to go with it;
    // otherwise autosave sees content still in memory and rewrites the draft.
    whitelistedAddresses.value = [];
    isWhitelistedDeposits.value = false;

    isClearCacheDialogOpen.value = false;
    refreshChainDrafts();
    toastStore.successToast("Draft cleared successfully");
  } catch (error) {
    console.error("Error clearing draft", error);
    toastStore.errorToast("Error clearing draft");
  }
}

// Computed
const isFundInitialized = computed(() => {
  // Return true if fund was initialized already
  return !!fundInitCache?.value?.fundContractAddr;
})

const currentStep = computed(() => stepperEntry.value[step.value - 1]);
const currentStepKey = computed(() => currentStep.value?.key);
const currentStepFields = computed(() => currentStep.value?.fields ?? []);

const permissionsStepNumber = computed(
  () =>
    stepperEntry.value.findIndex(
      (entry) => entry.key === OnboardingStep.Permissions,
    ) + 1,
);

/**
 * The last step the flow can reach at all. Permissions and the two steps after
 * it act on a deployed vault — there is no roles modifier to scope, no NAV
 * storage to write to and nothing to finalize until initialize has run — so
 * they stay shut until it has.
 */
const lastReachableStep = computed(() => {
  // The step before Permissions is Governance, which is where initializing
  // happens. Falls back to the whole flow if Permissions ever goes missing,
  // rather than locking a curator out of their own vault.
  if (isFundInitialized.value || permissionsStepNumber.value <= 1) {
    return stepperEntry.value.length;
  }
  return permissionsStepNumber.value - 1;
});

/**
 * How far the rail opens: everything reached so far, capped by the above. The
 * cap lives here rather than everywhere maxStepReached is written — that one
 * only ever grows, and has to keep remembering the steps behind it for when the
 * vault does come up.
 */
const maxStepUnlocked = computed(() =>
  Math.min(maxStepReached.value, lastReachableStep.value),
);

/**
 * The four steps that describe the vault are settled at initialization; after
 * that they are a record of what was sent, not a form.
 */
const isStepReadOnly = computed(
  () =>
    isFundInitialized.value &&
    [
      OnboardingStep.Basics,
      OnboardingStep.Fee,
      OnboardingStep.Whitelist,
      OnboardingStep.Governance,
    ].includes(currentStepKey.value),
);

const vaultSymbol = computed(() => {
  const field = stepperEntry.value
    .find((entry) => entry.key === OnboardingStep.Basics)
    ?.fields?.find((f) => f.key === "fundSymbol");
  return String(field?.value ?? "");
});

const fundFactoryContractV2AddressExists = computed(() => {
  return !!web3Store.chainContracts[selectedChainId.value]?.fundFactoryContractV2;
})

/**
 * Which factory initializes the vault. V2 unless the curator opted back to V1
 * — or unless this chain has no V2 factory deployed, where V1 is the only
 * thing there is and the toggle is not offered at all.
 */
const useV2Contract = computed(
  () => fundFactoryContractV2AddressExists.value && !useLegacyRolesV1.value,
);

/**
 * The toggle decides which factory initializes the vault, so it has to be
 * reachable on the step that initializes; the design also shows it beside the
 * permissions action, where it reports which roles version the vault ended up
 * on. Locked once initialized, in both places.
 */
const showRolesToggle = computed(
  () =>
    fundFactoryContractV2AddressExists.value &&
    [OnboardingStep.Governance, OnboardingStep.Permissions].includes(
      currentStepKey.value,
    ),
);

/**
 * What the toggle shows. Before initialization it is the curator's own choice;
 * afterwards it reports the vault that exists, read off the factory it actually
 * came from — a draft preference would otherwise keep being displayed as fact
 * on a vault someone else, or an earlier session, deployed.
 *
 * The setter only ever runs before initialization: the control is disabled once
 * there is a vault to disagree with.
 */
const rolesToggleValue = computed({
  get: () =>
    isFundInitialized.value
      ? !createFundStore.fundFactoryContractV2Used
      : useLegacyRolesV1.value,
  set: (value: boolean) => {
    useLegacyRolesV1.value = value;
  },
});

/**
 * Permissions and NAV methods both send transactions of their own and are then
 * done; the ghost button beside the primary is how the flow moves on from them.
 */
const showSkipButton = computed(() =>
  [OnboardingStep.Permissions, OnboardingStep.NavMethods].includes(
    currentStepKey.value,
  ),
);

const validationErrors = computed(() => currentStepValidation.value.errors);

const toggledOffFields = computed(() => {
  // check which fields are toggled off, and set them to 0 or null address
  return stepperEntry.value
    .map((step) => {
      return step.fields?.filter((field) => field.isToggleOn === false)
        .map((field) => {
          if (field.fields) {
            return field.fields
              .filter((subField) => !subField.isToggleOn)
              .map((subField) => subField.key);
          }
          return field.key;
        });
    })
    .flat(2)
    .flat();
});

const currentStepValidation = computed(() => {
  const errors: string[] = [];

  if (isFundInitialized.value) {
    return { isValid: true, errors };
  }

  const stepWithRegularFields = [
    OnboardingStep.Basics,
    OnboardingStep.Fee,
    OnboardingStep.Governance,
  ];

  const validateValue = (label: string, rules: any[], value: any) => {
    const values = Array.isArray(value) ? value : [value];

    for (const val of values) {
      for (const rule of rules) {
        const result = rule(val);
        if (result !== true) {
          // Rule messages are written to stand alone ("Field is required.",
          // "Address is not valid."), so the generic subject is dropped once a
          // field name is put in front of it — otherwise the footer reads
          // "Recipient address Address is not valid."
          errors.push(
            `${label} ${String(result).replace(/^(This field|Field|Address|Value) /, "")}`,
          );
          // Stop after first error, only add the first error to the errors list.
          return
        }
      }
    }
  };

  const validateField = (field: IField) => {
    if (!field?.rules) return;
    // A field showing its default greyed is filled in, even though its box is
    // empty — the footer would otherwise ask for something already decided.
    validateValue(field.label, field.rules, effectiveFieldValue(field, field.value));
  };

  if (currentStepKey.value === OnboardingStep.Basics && !selectedChainId.value) {
    errors.push("Chain is required.");
  }

  if (stepWithRegularFields.includes(currentStepKey.value) && currentStep.value?.fields) {
    currentStep.value.fields.forEach((field) => {
      if (field.isCustomValueToggleOn === false) return;

      if (field.fields) {
        if (!field.isToggleOn) return;
        field.fields.forEach(validateField);
      } else {
        validateField(field);
      }
    });
  }
  else if (currentStepKey.value === OnboardingStep.Whitelist) {
    if (isWhitelistedDeposits.value && activeWhitelistCount.value === 0) {
      errors.push("At least one address must be whitelisted.");
    }
  }

  return { isValid: errors.length === 0, errors };
});

const isCurrentStepValid = computed(() => currentStepValidation.value?.isValid);

const activeWhitelistCount = computed(
  () => whitelistedAddresses.value.filter((item) => !item.deleted).length,
);

const allowedDepositors = computed(() => {
  if (!isWhitelistedDeposits.value) {
    return [];
  }

  return whitelistedAddresses.value
    .filter((item) => !item.deleted)
    .map((item) => item.address);
});

/**
 * What the sticky footer's primary button does on this step. One descriptor
 * rather than five buttons with overlapping v-ifs, so the bar always has
 * exactly one primary and the label, the loading flag and the handler cannot
 * drift apart.
 */
const primaryAction = computed(() => {
  if (!accountStore.isConnected) return undefined;

  switch (currentStepKey.value) {
    case OnboardingStep.Governance:
      if (!isFundInitialized.value) {
        return {
          label: "Initialize vault",
          enabled: isCurrentStepValid.value,
          loading: isInitializeLoading.value,
          run: () => {
            isInitializeDialogOpen.value = true;
            loadReviewBaseTokenSymbol();
          },
        };
      }
      return nextAction.value;
    case OnboardingStep.Permissions:
      // The delegated-permissions editor on the second sub-step carries its
      // own Save Permissions button, with disabled states the footer cannot
      // see. Pressing "Store permissions" there would re-run the sub-step-0
      // finalize against a role with no edits and go nowhere, so the bar
      // offers no primary — the ghost Next remains the way onward.
      if (permissionsRef.value && !permissionsRef.value.isOnFirstSubStep) {
        return undefined;
      }
      return {
        label: "Store permissions",
        enabled: true,
        loading: !!permissionsRef.value?.isFinalizing,
        run: () => permissionsRef.value?.finalizePermissions(),
      };
    case OnboardingStep.NavMethods:
      return {
        label: "Store NAV methods",
        enabled: true,
        loading: !!navMethodsRef.value?.isStoring,
        run: () => navMethodsRef.value?.storeNavMethods(),
      };
    case OnboardingStep.Finalize:
      // Once it is done the step shows its own confirmation and a link out;
      // there is nothing left for the bar to offer.
      if (finalizeRef.value?.isDone) return undefined;
      return {
        label: "Finalize",
        enabled: true,
        loading: !!finalizeRef.value?.isFinalizing,
        run: () => finalizeRef.value?.finalize(),
      };
    default:
      return nextAction.value;
  }
});

const nextAction = computed(() => ({
  label: "Next",
  enabled: isCurrentStepValid.value,
  loading: false,
  run: goToNextStep,
}));

// Methods
// helper function to generate fields
const generateFields = (step: IOnboardingStep) => {
  const stepKey = step.key as OnboardingInitializingSteps;
  const lsStepperEntry = getLocalStorageItem(
    onboardingStepperEntryLocalStorageKey.value,
  ) || {} as IOnboardingStep[];

  if (!OnboardingFieldsMap[stepKey]) return [];

  const savedStep = Array.isArray(lsStepperEntry)
    ? lsStepperEntry.find((entry: IOnboardingStep) => entry.key === stepKey)
    : undefined;

  /**
   * Saved values are matched by key, never by position. A draft written before
   * a field was added, removed or reordered — the Basics step now leads with
   * the asset, and the fee groups no longer start with Deposit — would
   * otherwise pour each saved value into whatever field happens to sit at that
   * index now.
   */
  const savedFieldByKey = (key?: string) =>
    savedStep?.fields?.find((f: IField) => f.key === key);

  const savedGroupFor = (group: IFieldGroup) => {
    const groupKey = group.fields?.[0]?.key;
    return savedStep?.fields?.find(
      (f: IField) => f.fields?.[0]?.key === groupKey,
    );
  };

  const output = OnboardingFieldsMap[stepKey]?.map((field) => {
    if (field?.isToggleable) {
      const group = field as IFieldGroup;
      const savedGroup = savedGroupFor(group);

      return {
        ...group,
        isToggleOn: savedGroup?.isToggleOn ?? group?.isToggleOn,
        fields: group?.fields?.map((subField: IField) => ({
          ...subField,
          value:
            savedGroup?.fields?.find((f: IField) => f.key === subField.key)
              ?.value ?? subField?.value,
        })),
      } as IFieldGroup;
    }

    const fieldTyped = field as IField;
    const saved = savedFieldByKey(fieldTyped.key);

    return {
      ...fieldTyped,
      isCustomValueToggleOn:
        saved?.isCustomValueToggleOn ?? fieldTyped?.isCustomValueToggleOn,
      value: saved?.value ?? fieldTyped?.value,
    } as IField;
  });

  // find the basic step and add custom fields to that step
  if (stepKey === OnboardingStep.Basics) {
    const customFields = (savedStep?.fields ?? []).filter(
      (field: IField) => field.isFieldByUser,
    );

    return output.concat(
      customFields.map((field: IField) => ({
        ...field,
        rules: [formRules.required],
      })),
    );
  }

  return output;
}


const getFieldByStepAndFieldKey =(
  stepKey: string,
  fieldKey: string,
) => {
  // Find the step key and then find the field key.
  // TODO this flat map will break if nesting gets deeper than one level
  const field = stepperEntry.value
    ?.find(step => step.key === stepKey)?.fields
    ?.flatMap(field => [field, ...field?.fields || []])
    ?.find(field => field?.key === fieldKey);

  if (!field) {
    console.error(`Field ${fieldKey} not found in step ${stepKey}`, field);
    return;
  }
  const fieldValue = field?.value;

  if (field?.isCustomValueToggleOn === false) {
    return field?.defaultValue;
  }

  return effectiveFieldValue(field, fieldValue) ?? field?.defaultValue;
}


/**
 * Symbol of the chosen denomination asset, read on the chain when the
 * initialize dialog opens. The Basics step reads it too, but into its own
 * state — and the dialog only needs it for the one second it is on screen.
 */
const reviewBaseTokenSymbol = ref("");

const loadReviewBaseTokenSymbol = async () => {
  reviewBaseTokenSymbol.value = "";
  const address = String(
    getFieldByStepAndFieldKey(OnboardingStep.Basics, "baseToken") ?? "",
  );
  if (!ethers.isAddress(address)) return;

  try {
    const [, symbol] = await fetchBaseTokenDetails(selectedChainId.value, address);
    reviewBaseTokenSymbol.value = String(symbol ?? "");
  } catch (error) {
    // The address is still printed in full; a missing ticker only costs the
    // curator the friendlier half of the line.
    console.error("Failed reading denomination asset symbol for review", error);
  }
};

/**
 * Governance durations are stored as block counts, so a duration beside one is
 * only ever an estimate — and only possible on a chain whose block time has
 * already been read. PeriodControl fills that cache on the Governance step,
 * which is the step this dialog opens from.
 */
const averageBlockTime = computed(
  () =>
    blockTimeStore.chainBlockTimeContext[
      web3Store.getL2ToL1ChainId(selectedChainId.value)
    ]?.averageBlockTime ?? 0,
);

const formatBlocks = (value: unknown) => {
  const blocks = Number(value);
  if (!Number.isFinite(blocks)) return "";
  return `${blocks.toLocaleString("en-US")} ${blocks === 1 ? "block" : "blocks"}`;
};

const blocksAsDuration = (value: unknown) => {
  const blocks = Number(value);
  if (!Number.isFinite(blocks) || blocks <= 0 || averageBlockTime.value <= 0) {
    return "";
  }
  return formatApproximateDuration(blocks * averageBlockTime.value);
};

/**
 * What initializing decides for good, printed with the value it is about to
 * take. Mirrors the FIXED chips the steps carry beside these same fields: the
 * vault's identity and denomination are written into the deployment, and the
 * governor is constructed with its voting rules rather than configured after.
 */
const immutableSummary = computed(() => {
  const basics = (key: string) =>
    getFieldByStepAndFieldKey(OnboardingStep.Basics, key);
  const governance = (key: string) =>
    getFieldByStepAndFieldKey(OnboardingStep.Governance, key);

  const baseToken = String(basics("baseToken") ?? "");
  const governanceToken = String(governance("governanceToken") ?? "");
  const quorum = governance("quorum");

  return [
    {
      title: "Vault",
      rows: [
        { label: "Network", value: selectedChainName.value },
        {
          label: "Denomination asset",
          value: reviewBaseTokenSymbol.value || truncateAddressEllipsis(baseToken),
          note: reviewBaseTokenSymbol.value ? truncateAddressEllipsis(baseToken) : "",
        },
        { label: "Vault name", value: String(basics("fundName") ?? "") },
        { label: "Vault token symbol", value: String(basics("fundSymbol") ?? "") },
      ],
    },
    {
      title: "Governance",
      rows: [
        {
          label: "Governance token",
          // Zero means the vault's own share token carries the votes, which is
          // the default and reads as nothing at all when printed as an address.
          value: isZeroAddress(governanceToken)
            ? "Vault token"
            : truncateAddressEllipsis(governanceToken),
          note: "",
        },
        {
          label: "Quorum",
          value: quorum == null || quorum === "" ? "" : `${quorum}%`,
          note: "",
        },
        {
          label: "Proposal threshold",
          value: `${Number(governance("proposalThreshold") ?? 0).toLocaleString("en-US")} tokens`,
          note: "",
        },
        {
          label: "Voting period",
          value: formatBlocks(governance("votingPeriod")),
          note: blocksAsDuration(governance("votingPeriod")),
        },
        {
          label: "Voting delay",
          value: formatBlocks(governance("votingDelay")),
          note: blocksAsDuration(governance("votingDelay")),
        },
        {
          label: "Late quorum",
          value: formatBlocks(governance("lateQuorum")),
          note: blocksAsDuration(governance("lateQuorum")),
        },
      ],
    },
  ];
});

/**
 * The field itself, where getFieldByStepAndFieldKey resolves to a value. Only
 * the vault image needs this: it is the one field whose stored value is
 * rewritten on the way to the contract.
 */
const findFieldByStepAndFieldKey = (stepKey: string, fieldKey: string) =>
  stepperEntry.value
    ?.find(step => step.key === stepKey)?.fields
    ?.flatMap(field => [field, ...field?.fields || []])
    ?.find(field => field?.key === fieldKey);

/**
 * Turns the pending vault image into a hosted URL.
 *
 * The image is carried through the whole flow as a data URL and only posted
 * here, one step before the transaction. The upload endpoint takes no auth, so
 * the thing keeping it from filling up with the logos of drafts nobody launched
 * is that it never sees them — it only hears from curators about to spend gas.
 * Writing the result back into the field also means the draft stops carrying
 * the base64 copy.
 */
const uploadPendingVaultImage = async () => {
  const field = findFieldByStepAndFieldKey(OnboardingStep.Basics, "photoUrl");
  if (!field || !isPendingVaultImage(field.value)) return;

  field.value = await uploadVaultImage(field.value as string);
};


const findCustomFieldsFromStep = (stepKey: string) => {
  const stepIndex = stepperEntry.value.findIndex(
    (step) => step.key === stepKey,
  );

  if (stepIndex !== -1) {
    const stepFields = stepperEntry.value[stepIndex].fields ?? [];

    // find custom fields (fields that has key "isFieldByUser")
    return stepFields?.filter(
      (field) => {
        return field.isFieldByUser;
      },
    ) ?? [];
  }

  return [];
};

const formatFundMetaData = () => {
  // find fields with key "isFieldByUser" from basics step and add them to the fund metadata
  const customFields = findCustomFieldsFromStep(OnboardingStep.Basics);

  return  {
    description: getFieldByStepAndFieldKey(OnboardingStep.Basics, "description"),
    photoUrl: getFieldByStepAndFieldKey(OnboardingStep.Basics, "photoUrl"),
    plannedSettlementPeriod: getFieldByStepAndFieldKey(OnboardingStep.Basics, "plannedSettlementPeriod"),
    strategistName : getFieldByStepAndFieldKey(OnboardingStep.Basics, "strategistName"),
    strategistUrl : getFieldByStepAndFieldKey(OnboardingStep.Basics, "strategistUrl"),
    oivChatUrl : getFieldByStepAndFieldKey(OnboardingStep.Basics, "oivChatUrl"),
    ...Object.fromEntries(customFields.map((field) => [field.key, field.value])),
  }
};

const getFeeValue = (feeKey: string) => {
  return toggledOffFields.value.includes(feeKey)
    ? 0
    : Number(fromPercentageToBps(getFieldByStepAndFieldKey(OnboardingStep.Fee, feeKey)));
};

const getFeeCollectors = (feeKey: string) => {
  return toggledOffFields.value.includes(feeKey)
    ? ethers.ZeroAddress
    : getFieldByStepAndFieldKey(OnboardingStep.Fee, feeKey);
};

const formatFeeCollectors = () => {
  return [
    getFeeCollectors("depositFeeRecipientAddress"),
    getFeeCollectors("withdrawFeeRecipientAddress"),
    getFeeCollectors("managementFeeRecipientAddress"),
    getFeeCollectors("performanceFeeRecipientAddress"),
  ]
};

const formatInitializeData = () => {
  const output = [
    [
      getFeeValue("depositFee"),// depositFee
      getFeeValue("withdrawFee"),// withdrawFee
      getFeeValue("performanceFee"),// performanceFee
      getFeeValue("managementFee"),// managementFee
      0, // performaceHurdleRateBps, default to 0
      getFieldByStepAndFieldKey(OnboardingStep.Basics, "baseToken"), // baseToken
      "0x0000000000000000000000000000000000000000",
      false,
      false,
      allowedDepositors.value, // allowedDepositAddrs
      [], // allowedManagers, default empty array
      getFieldByStepAndFieldKey(OnboardingStep.Governance, "governanceToken"), // governanceToken
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      getFieldByStepAndFieldKey(OnboardingStep.Basics, "fundName"),
      getFieldByStepAndFieldKey(OnboardingStep.Basics, "fundSymbol"),
      formatFeeCollectors(),
    ],
    [
      parseInt(getFieldByStepAndFieldKey(OnboardingStep.Governance, "quorum") as string), // quorumFraction
      parseInt(getFieldByStepAndFieldKey(OnboardingStep.Governance, "lateQuorum") as string),
      parseInt(getFieldByStepAndFieldKey(OnboardingStep.Governance, "votingDelay") as string),
      parseInt(getFieldByStepAndFieldKey(OnboardingStep.Governance, "votingPeriod") as string),
      parseInt(getFieldByStepAndFieldKey(OnboardingStep.Governance, "proposalThreshold") as string),
    ],
    JSON.stringify(formatFundMetaData()),
    0, // feePerformancePeriod, default to 0
    0, // managementFeePeriod, default to 0
  ]

  return output;
}

/**
 * Explicit gas limits for initCreateFund, keyed by chain.
 *
 * HyperEVM mines 3,000,000-gas "small blocks" by default and only an occasional
 * 30,000,000-gas big block. initCreateFund measures at ~4,650,000 gas, so it fits
 * in neither the small-block limit nor the 1,000,000 that gets sent when
 * estimation is unavailable — and on HyperEVM eth_estimateGas reverts for this
 * call rather than returning a number, so there is nothing to estimate from.
 *
 * Necessary but not sufficient: the sender must also have opted into big blocks
 * on Hyperliquid (evmUserModify, usingBigBlocks), which no frontend setting can
 * substitute for. Without that the transaction is routed to a 3M block and
 * reverts with no reason string, which reads as a contract failure rather than a
 * gas ceiling.
 *
 * Chains absent from this map keep the normal estimation path.
 */
const INIT_CREATE_FUND_GAS: Partial<Record<ChainId, number>> = {
  [ChainId.HYPEREVM]: 6_000_000,
};

/** Opts an address into HyperEVM's 30,000,000-gas big blocks. */
const HYPEREVM_BIG_BLOCK_TOGGLE_URL = "https://hyperevm-block-toggle.vercel.app/";

/**
 * Explain a failed initCreateFund.
 *
 * On HyperEVM the overwhelmingly likely cause is that the sender has not opted
 * into big blocks: the call needs ~4,650,000 gas while ordinary blocks cap at
 * 3,000,000, so it reverts with no reason string. Nothing about that failure
 * points at its cause — it reads as a contract bug — so name it and link the
 * toggle. Held open until dismissed, because it asks the reader to go and do
 * something before retrying.
 */
const toastInitializeFailed = (chainId: ChainId) => {
  if (chainId === ChainId.HYPEREVM) {
    return toastStore.errorToast(
      "HyperEVM big blocks is not enabled. Gas limit too high.",
      -1,
      { url: HYPEREVM_BIG_BLOCK_TOGGLE_URL, label: "Enable big blocks" },
    );
  }
  toastStore.errorToast(
    "Fund initialization transaction has failed. Please contact the Rethink Finance community for support.",
  );
};

/**
 * A wallet rejection arrives on the same channel as an on-chain revert, but the
 * reader chose it and does not need it explained. Only a revert should raise
 * the big-blocks hint.
 */
const isRevertError = (error: any) =>
  /revert/i.test(String(error?.message ?? ""));

const initializeFund = async() => {
  const fundChainId = selectedChainId.value;

  try {
    isInitializeLoading.value = true;
    // Use V2 contract if toggle is enabled, otherwise use regular contract
    const contractKey = useV2Contract.value ? "fundFactoryContractV2" : "fundFactoryContract";
    const fundFactoryContract = web3Store.chainContracts[fundChainId]?.[contractKey];

    if (!fundFactoryContract) {
      return toastStore.errorToast(
        `Cannot create fund on chain ${fundChainId}. ${useV2Contract.value ? "V2 contract" : "Contract"} not available.`,
      );
    }

    // Aborts on failure rather than carrying on: the metadata is written once
    // and cannot be edited afterwards, so a data URL that slipped through would
    // be a permanent, unfixable blob in the vault's on-chain record.
    try {
      await uploadPendingVaultImage();
    } catch (error: any) {
      console.error("Failed uploading the vault image", error);
      return toastStore.errorToast(
        `Could not upload the vault image — ${error?.message || "the image service did not respond"}. ` +
        "Try again, or paste a hosted image URL on the Basics step.",
      );
    }

    const formattedData = formatInitializeData();
    const gasLimit = INIT_CREATE_FUND_GAS[fundChainId];

    await fundFactoryContract
      .send("initCreateFund", gasLimit ? { gas: gasLimit } : {}, ...formattedData)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      }).on("receipt", (receipt: any) => {
        if (receipt.status) {
          toastStore.successToast("Fund initialization was successful. Wait for node to sync and go to next step.");
          // Start fetching fund init cache so that the user can go to the next step.
          // Repeat at least 10 times until the cache is there. Wait 1 sec between each try.
          repeatUntilFundInitCacheExists(20, 1000);
        } else {
          toastInitializeFailed(fundChainId);
        }
      }).on("error", (error: any) => {
        console.error("error when initializing", error);
        isInitializeLoading.value = false;
        if (isRevertError(error)) {
          toastInitializeFailed(fundChainId);
          return;
        }
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error:any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the vault");
  } finally {
    isInitializeDialogOpen.value = false;
    isInitializeLoading.value = false;
  }
};

// Called after init fund create.
const repeatUntilFundInitCacheExists = async (maxRetries: number, intervalMs: number): Promise<void> => {
  isCheckingIfFundInitCacheExists.value = true;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await fetchFundInitCache();
    if (fundInitCache?.value?.fundContractAddr) {
      // Redirect to next step, permissions.
      isCheckingIfFundInitCacheExists.value = false;
      goToNextStep()
      return;
    }

    console.log(`Fund Init Cache fetch attempt ${attempt} failed. Retrying in ${intervalMs / 1000} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  isCheckingIfFundInitCacheExists.value = false;
  // TODO show some alert to refresh later
  console.log("Cache is still not available after maximum retries.");
};

const initStepperEntry = () => {
  // generate stepper entry from local storage
  const lsWhitelist = getLocalStorageItem(
    onboardingWhitelistLocalStorageKey.value,
  );

  // Set whitelist from local storage.
  if (lsWhitelist){
    isWhitelistedDeposits.value = lsWhitelist.isWhitelistedDeposits ?? false;
    whitelistedAddresses.value = lsWhitelist.whitelistedAddresses ?? [];
  }

  return OnboardingStepMap?.map((step) => ({
    name: step?.name ?? "",
    key: step?.key ?? "",
    info: step?.info ?? "",
    fields: generateFields(step),
  })) as IOnboardingStep[];
};


/** Writes the current form to the selected chain's draft, silently. */
const writeDraftToLocalStorage = () => {
  setLocalStorageItem(
    onboardingStepperEntryLocalStorageKey.value,
    stepperEntry.value,
  );

  // Save whitelist data to local storage
  setLocalStorageItem(
    onboardingWhitelistLocalStorageKey.value,
    {
      whitelistedAddresses: whitelistedAddresses.value,
      isWhitelistedDeposits: isWhitelistedDeposits.value,
    },
  );
};

const getChainDrafts = () => {
  return chainIdValues.value.map((chainId) => {
    const drafts = (getLocalStorageItem(`onboardingStepperEntry_${chainId}`) || []) as IOnboardingStep[];
    return {
      chainId,
      hasDrafts: drafts.length > 0,
    };
  });
};


const setDefaultSelectedChainId = () =>{
  const chainDrafts = getChainDrafts();

  if (step.value === 1) {
    const chainWithDraftConnectedWallet = chainDrafts.find((chain) => chain.hasDrafts && chain.chainId === accountStore.connectedWalletChainId);
    const chainWithDraft = chainDrafts.find((chain) => chain.hasDrafts);

    // 1. try to set the chain with draft and connected wallet
    if (chainWithDraftConnectedWallet) {
      selectedChainId.value = chainWithDraftConnectedWallet.chainId;
    }
    // 2. try to set the chain with draft
    else if (chainWithDraft) {
      selectedChainId.value = chainWithDraft.chainId;
    }
    // 3. set the connected wallet chain
    else if (accountStore.connectedWalletChainId &&
      chainIdValues?.value?.includes(accountStore.connectedWalletChainId)
    ) {
      selectedChainId.value = accountStore.connectedWalletChainId;
    }
  }
  createFundStore.setSelectedStepperChainId(selectedChainId.value);
}

const stepperEntry = ref(initStepperEntry());

// Watchers
watch(() => isCreateFundPasswordCorrect.value, (isPasswordCorrect) => {
  if (isPasswordCorrect) {
    setLocalStorageItem("isCreateFundPasswordCorrect", true);
  }
});

watch(() => selectedChainId.value, () => {
  createFundStore.setSelectedStepperChainId(selectedChainId.value);

  // clear fetched fund if we change the chain
  createFundStore.clearFundInitCache();
  fundInitCache.value = undefined;
  // Reloads this chain's draft, or an empty form where it has none.
  stepperEntry.value = initStepperEntry();
  // A different chain is a different workspace — its own draft, its own vault,
  // its own progress — so the rail starts at the top rather than sitting on a
  // step that belonged to the chain just left.
  step.value = 1;
  maxStepReached.value = 1;
  // The chain is picked on the first step now, so there is no later step to
  // fetch the cache on the way into — it has to happen here.
  fetchFundInitCache();
});

/**
 * An initialized vault has nothing left to fill in on the first four steps, so
 * the rail opens as far as the work that remains. Keyed off the flag rather
 * than the fetch call, so it covers the first load and every chain switch alike.
 */
watch(isFundInitialized, (initialized) => {
  if (!initialized) return;
  maxStepReached.value = Math.max(maxStepReached.value, permissionsStepNumber.value);
});

watch(() => accountStore.activeAccountAddress, () => {
  stepperEntry.value = initStepperEntry();
  fetchFundInitCache();
});

watch(()=> accountStore.connectedWalletChainId, (_newVal, oldVal) =>{
  if(!oldVal){
    setDefaultSelectedChainId()
  }
})

/**
 * Every change to the form or the whitelist is a change to the draft. Deep,
 * because the values live inside the field tree rather than on refs of their
 * own, and gated on initialization because an initialized vault is read from
 * the chain and has nothing left to draft.
 */
watch(
  [stepperEntry, whitelistedAddresses, isWhitelistedDeposits],
  () => {
    if (isFundInitialized.value) return;
    isSavingDraft.value = true;
    autoSaveDraft();
  },
  { deep: true },
);

// Lifecycle Hooks
onBeforeRouteLeave((_to, _from, next) => {
  // allow page change if the user is not validated (he is seeing the password page)
  if (!isCreateFundPasswordCorrect.value) {
    next();
    return;
  }

  // Leaving used to ask whether to keep the work; it is already kept. The flush
  // is only here because a change made in the last 600ms may still be waiting.
  flushDraft();
  next();
});

watch(step, (value) => {
  maxStepReached.value = Math.max(maxStepReached.value, value);
});

/**
 * A vault can stop being initialized underfoot — a switched account, a cleared
 * cache — and leave the flow standing on Permissions with nothing to point at.
 * Walk it back to the last step that still has something to do.
 */
watch(lastReachableStep, (last) => {
  if (step.value > last) step.value = last;
});

const chainIdValues = computed(() => networkChoices.map((choice: any) => choice.value));

onMounted(() => {
  refreshChainDrafts();
  // Set selected chain to user's current network.
  setDefaultSelectedChainId()
  // The draft key hangs off the store's chain, which the line above has only
  // just settled — and the form was built before that, against whatever the
  // store defaulted to. The chain watcher would normally rebuild it, but it
  // does not fire when the resolved chain already equals the initial one, which
  // is exactly the common case. Rebuilding here is what puts a saved draft on
  // screen instead of an empty form sitting on top of one.
  stepperEntry.value = initStepperEntry();
  fetchFundInitCache();
});

// A tab closed or reloaded mid-edit still gets the last 600ms of work.
onBeforeUnmount(() => flushDraft());
</script>

<style scoped lang="scss">
.create {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 1rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 40px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: $color-white;
  }

  &__header_actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  /* Sized to its content rather than to a column, the way the ghost button
     beside it is — the shared dropdown fills its cell by default. */
  &__chain_select {
    width: auto;

    :deep(.select_menu__trigger) {
      padding: 8px 12px;
      font-size: 11.5px;
    }
    :deep(.select_menu__panel) {
      left: auto;
      right: 0;
      min-width: 15rem;
    }
  }

  &__chain_option {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
  }

  /* Reads as a marker on the row, not as an action: no border, no hit area,
     just the one word that says there is something waiting on that chain. */
  &__chain_draft {
    flex: none;
    font-family: $font-mono;
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__saved {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    color: $color-steel-blue;
  }

  /**
   * The page's secondary buttons. Typed like the primary beside them rather
   * than like a mono field label — Back and Next are read as a pair, and a
   * letterspaced uppercase Back next to a sentence-case Next reads as two
   * different kinds of control. Matches .v-btn: sans, $text-sm, no transform.
   */
  &__ghost {
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-sans;
    font-size: $text-sm;
    font-weight: 600;
    color: $color-white;
    cursor: pointer;
    transition: border-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }
    &--danger:hover {
      border-color: $color-neg-line;
      color: $color-neg;
    }
  }

  &__banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.875rem 1.125rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    background: $color-cyan-tint;
    font-size: 13px;
    line-height: 1.5;
    color: $color-white;
  }

  &__banner_badge {
    padding: 0.25rem 0.5rem;
    border: 1px solid $color-cyan-line;
    border-radius: $default-border-radius;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__card {
    padding: 30px 32px;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-surface;
  }

  &__body--locked {
    opacity: 0.55;
    pointer-events: none;
  }

  &__gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 3rem 0;
    text-align: center;
    font-size: 14px;
    color: $color-steel-blue;
  }

  &__footer {
    position: sticky;
    bottom: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    flex-wrap: wrap;
    padding: 1rem 0;
    /* The bar has no surface of its own; the page colour sits behind it and
       fades out over the strip above, so what it covers reads as scrolling
       under rather than as cut off. Opaque under the bar itself, because the
       error list can grow to eight lines and every one of them has to stay
       legible over whatever field it happens to sit on. */
    background: $color-dark;

    &::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 100%;
      height: 1.5rem;
      background: linear-gradient(to top, $color-dark, transparent);
      pointer-events: none;
    }
  }

  &__footer_side {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;

    &--end {
      margin-left: auto;
      justify-content: flex-end;
    }
  }

  &__errors {
    max-width: 40ch;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.45;
    text-align: right;
    color: $color-neg;
  }

  &__roles {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__roles_label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  /* Kept in place rather than hidden: a button that vanishes when a field is
     wrong takes the explanation of what to do next with it. */
  &__primary--off {
    opacity: 0.5;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    &__ghost {
      transition: none;
    }
  }
}

/**
 * The initialize review inside the confirm dialog. Label on the left in the
 * app's mono eyebrow, value on the right in white — the same two-part reading
 * the data tooltips and the field labels already use, so a curator scanning it
 * is scanning something familiar rather than a new kind of table.
 */
.init_review {
  &__group + &__group {
    margin-top: 1.125rem;
  }

  &__group_title {
    padding-bottom: 0.5rem;
    border-bottom: 1px solid $color-line-2;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__rows {
    margin: 0;
  }

  /* Two columns rather than a definition list's stacked default: the value is
     the thing being checked, and it should line up down the panel. */
  &__row {
    display: grid;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
    align-items: baseline;
    gap: 1rem;
    padding: 0.4375rem 0;

    & + & {
      border-top: 1px solid $color-line;
    }
  }

  &__label {
    font-size: 12.5px;
    line-height: 1.45;
    color: $color-steel-blue;
  }

  &__value {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0;
    font-family: $font-mono;
    font-size: 12.5px;
    line-height: 1.45;
    text-align: right;
    font-variant-numeric: tabular-nums;
    word-break: break-word;
    color: $color-white;

    /* A required field cannot reach this dialog empty, but an optional one
       can, and a blank cell reads as a rendering failure. */
    &--empty {
      color: $color-steel-blue;
    }
  }

  /* The second half of a value that has one — a ticker's address, a block
     count's duration. Quieter, because it is the derived half. */
  &__note {
    font-size: 11px;
    color: $color-steel-blue;
  }
}
</style>
