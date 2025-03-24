<template>
  <div class="d-flex" style="width: 100%; flex-direction: column; height: 100%;">
    <OnboardingPasswordProtect
      v-if="!isCreateFundPasswordCorrect"
      v-model:is-password-correct="isCreateFundPasswordCorrect"
    />

    <v-stepper
      v-else
      ref="stepper"
      v-model="step"
      class="stepper_onboarding"
    >
      <v-overlay
        :model-value="isLoadingFetchFundCache"
        class="d-flex justify-center align-center"
        opacity="0.12"
        contained
        persistent
      >
        <v-progress-circular
          class="stepper_onboarding__loading_spinner"
          size="70"
          width="3"
          indeterminate
        />
      </v-overlay>

      <v-stepper-header>
        <v-stepper-item
          v-for="(item, index) in stepperEntry"
          :key="index"
          :step="index + 1"
          :complete="index + 1 < step"
          :value="index + 1"
        >
          <template #default>
            <span>{{ item.name }}</span>
          </template>
        </v-stepper-item>
      </v-stepper-header>

      <v-stepper-actions>
        <template #next>
          <div class="buttons">
            <div class="item">
              <v-btn
                v-if="showClearCacheButton"
                class="me-8"
                variant="outlined"
                @click="isClearCacheDialogOpen = true"
              >
                Clear Draft
              </v-btn>
              <v-btn
                v-if="showInitializeButton"
                :loading="isInitializeLoading"
                class="bg-primary text-white"
                :disabled="isFundInitialized || !isCurrentStepValid || !accountStore.isConnected"
                @click="isInitializeDialogOpen = true"
              >
                Initialize
                <v-tooltip
                  v-if="!accountStore.isConnected"
                  :model-value="true"
                  activator="parent"
                  location="top"
                  @update:model-value="true"
                >
                  Connect your wallet to initialize the OIV
                </v-tooltip>
              </v-btn>
              <v-tooltip
                activator="parent"
                location="bottom"
                :disabled="isCurrentStepValid"
              >
                <template #activator>
                  <v-btn
                    v-if="showButtonNext"
                    :disabled="!isCurrentStepValid"
                    @click="goToNextStep"
                  >
                    Next
                  </v-btn>
                </template>
                <template #default>
                  Please fill out all required fields
                </template>
              </v-tooltip>
            </div>
          </div>
        </template>
        <template #prev>
          <v-btn
            v-if="step !== 1"
            @click="step--"
          >
            Back
          </v-btn>
        </template>
      </v-stepper-actions>

      <v-dialog
        :model-value="isCheckingIfFundInitCacheExists"
        scrim="black"
        opacity="0.3"
        max-width="600px"
        persistent
        @update:model-value="isCheckingIfFundInitCacheExists = false"
      >
        <div class="main_card di_card d-flex">
          <v-progress-circular
            class="d-flex me-3"
            size="20"
            width="3"
            indeterminate
          />
          Loading OIV init cache...
        </div>
      </v-dialog>
      <v-window v-model="step">
        <v-tooltip
          activator="parent"
          location="top"
          :disabled="!showInitializeTooltip"
        >
          <template #activator>
            <v-window-item
              v-for="(item, stepIndex) in stepperEntry"
              :key="stepIndex"
              :value="stepIndex + 1"
            >
              <div
                v-if="item.key === OnboardingStep.Chain && accountStore.isConnected"
                class="d-flex justify-center mb-6"
              >
                <UiButtonSelectChain
                  v-model="selectedChainId"
                  label="Select OIV Chain"
                  label-center
                />
              </div>
              <div
                v-else-if="item.key === OnboardingStep.Chain && !accountStore.isConnected"
                class="connect_wallet"
              >
                In order to create an OIV, you need to connect your wallet.

                <v-btn
                  class="bg-primary text-secondary"
                  @click="accountStore.connectWallet()"
                >
                  Connect Wallet
                </v-btn>
              </div>

              <OnboardingInfoFIelds
                v-if="item.fields"
                :fields="item.fields"
                :is-fund-initialized="isFundInitialized"
                :step="step"
                :chain-id="selectedChainId"
                @delete-row="(e) => deleteCustomFieldRow(e, item.key)"
              />

              <!-- STEP BASICS -->
              <OnboardingAddNewField
                v-if="item.key === OnboardingStep.Basics && !isFundInitialized"
                @add-custom-field="(e) =>addCustomFieldRow(e, OnboardingStep.Basics)"
              />

              <!-- STEP WHITELIST -->
              <OnboardingWhitelist
                v-if="item.key === OnboardingStep.Whitelist"
                v-model="whitelistedAddresses"
                v-model:whitelist-enabled="isWhitelistedDeposits"
                :is-editable="!isFundInitialized"
              />

              <!-- STEP PERMISSIONS -->
              <OnboardingPermissions
                v-if="item.key=== OnboardingStep.Permissions"
              />

              <!-- STEP NAV METHODS -->
              <OnboardingNavMethods
                v-if="item.key === OnboardingStep.NavMethods"
                :chain-id="fundChainId"
                :fund-settings="fundSettings"
              />

              <!-- STEP FINALISE -->
              <OnboardingFinalize
                v-if="item.key === OnboardingStep.Finalize"
                :fund-chain-id="fundChainId"
              />

              <v-col>
                <UiInfoBox
                  v-if="item.info"
                  class="info-box"
                  :info="item.info"
                />
              </v-col>
            </v-window-item>
          </template>
          <template #default>
            OIV has been initialized already and cannot be edited.<br>
            You can add permissions & NAV Methods and finalize OIV creation.
          </template>
        </v-tooltip>
      </v-window>

      <UiConfirmDialog
        v-model="saveChangesDialog"
        title="Heads Up!"
        confirm-text="Save"
        cancel-text="Don't save"
        message="Do you want to save the changes?"
        class="confirm_dialog"
        max-width="600px"
        @confirm="saveDraftToLocalStorage"
        @cancel="handleCloseSaveChangesDialog"
      />

      <UiConfirmDialog
        v-model="isInitializeDialogOpen"
        title="Heads Up!"
        confirm-text="Initialize"
        message="You will not be able to change the OIV settings after you initialize it. Changes will require governance proposal."
        class="confirm_dialog"
        max-width="600px"
        :loading="isInitializeLoading"
        @confirm="initializeFund"
        @cancel="isInitializeDialogOpen = false"
      />

      <UiConfirmDialog
        v-model="isClearCacheDialogOpen"
        title="Heads Up!"
        confirm-text="Clear"
        cancel-text="Don't clear"
        :message="clearCacheMessage"
        class="confirm_dialog"
        max-width="600px"
        @confirm="handleClearCache"
        @cancel="isClearCacheDialogOpen = false"
      >
        <p class="mt-4">
          This action will clear the create OIV form data for the selected chain.
          You will lose all the saved data you have entered so far.
        </p>
      </UiConfirmDialog>
    </v-stepper>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { fromBpsToPercentage } from "~/composables/formatters";
import { useAccountStore } from "~/store/account/account.store";
import { useActionStateStore } from "~/store/actionState.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { networkChoices, networksMap } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import { ActionState } from "~/types/enums/action_state";
import type { ChainId } from "~/types/enums/chain_id";
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
const toastStore = useToastStore();
const actionStateStore = useActionStateStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();
const createFundStore = useCreateFundStore();

// Data
const {
  fundChainId,
  fundInitCache,
  askToSaveDraftBeforeRouteLeave,
  onboardingWhitelistLocalStorageKey,
  onboardingStepperEntryLocalStorageKey,
} = storeToRefs(createFundStore);
const step = ref(1);

const saveChangesDialog = ref(false);
const isInitializeDialogOpen = ref(false);
const isInitializeLoading = ref(false);
const isClearCacheDialogOpen = ref(false);
// If user already authenticated before set isCreateFundPasswordCorrect to true.
const isCreateFundPasswordCorrect = ref<boolean>(
  getLocalStorageItem("isCreateFundPasswordCorrect", false),
);

// store the resolve/reject functions for the save changes dialog
let nextRouteResolve: Function | null = null;

// whitelist data
const whitelistedAddresses = ref<IWhitelist[]>([]);
const isCheckingIfFundInitCacheExists = ref(false);
const isWhitelistedDeposits = ref(false);
const selectedChainId = ref<ChainId>(networkChoices[0].value);

const fundSettings = computed<IFundSettings>(() => fundInitCache?.value?.fundSettings || {} as IFundSettings);
const fundMetadata = computed(() => fundInitCache?.value?.fundMetadata || {});
const fundGovernorData = computed(() => fundInitCache?.value?.governorData || {});

// Fetch Fund Cache and fill the form data with the fetched fund cache.
const setFieldValue = (field: IField): void => {
  if (![InputType.Image, InputType.Textarea, InputType.Select, InputType.Period].includes(field.type)) {
    field.type = InputType.Text;
  }
  field.isToggleable = false;

  const fieldKey = field.key as string;
  // Convert some fields to text fields, as they are all readonly.
  if (fieldKey in fundSettings.value) {
    let value = fundSettings.value[fieldKey];
    if (feeFieldKeys.includes(fieldKey)) {
      value = Number(fromBpsToPercentage(value));
    }

    field.value = value;
  } else if (fieldKey in fundMetadata.value) {
    field.value = fundMetadata.value[fieldKey];
  } else if (fieldKey in fundGovernorData.value) {
    field.value = fundGovernorData.value[fieldKey];
  } else {
    console.error(" field key missing", field);
  }
}
const fetchFundInitCache = async () => {
  if (!selectedChainId.value) return;

  if (accountStore.activeAccountAddress) {
    // Take stepper entry chain id from the local storage
    await createFundStore.fetchFundInitCache(
      selectedChainId.value,
      accountStore.activeAccountAddress,
    );

    for (const step of stepperEntry.value) {
      for (const field of step.fields || []) {
        if ("fields" in field) {
          // Field is of type IFieldGroup, has more subfields.
          // TODO here we only go 2 levels deep, but IField can have infinite levels, do recursion for fields.
          for (const subField of field.fields || []) {
            setFieldValue(subField);
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
    // clear local storage for this chain
    createFundStore.clearFundLocalStorage();
    // if fund is initialized, don't ask user to save draft
    askToSaveDraftBeforeRouteLeave.value = false;
  } else {
    createFundStore.clearFundInitCache();
  }
}


const clearCacheMessage = computed(() => {
  const selectedChainName = networksMap[selectedChainId.value]?.chainName;
  if (!selectedChainName) return "Are you sure you want to clear the cache for this chain?";

  return `Are you sure you want to clear the cache for <strong>${selectedChainName}</strong>?`
});

const isLoadingFetchFundCache = computed(() =>
  actionStateStore.isActionState(
    "fetchFundInitCacheAction",
    ActionState.Loading,
  ),
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
  step.value += 1;
  // Going from step 1) Chain to 2) Basics, we fetch fund init cache if it exsits.
  if (step.value === 2) {
    // Reset stepper entry if chain has changed.
    // TODO do both only if chain has changed!!
    stepperEntry.value = initStepperEntry();

    fetchFundInitCache();
  }
}

const handleClearCache = () => {
  try {
    createFundStore.clearFundLocalStorage();
    stepperEntry.value = initStepperEntry();
    isClearCacheDialogOpen.value = false;
    toastStore.successToast("Cache cleared successfully");
  } catch (error) {
    console.error("Error clearing cache", error);
    toastStore.errorToast("Error clearing cache");
  }
}

// Computed
const isFundInitialized = computed(() => {
  // Return true if fund was initialized already
  console.log("isFundInitialized", !!fundInitCache?.value?.fundContractAddr)
  return !!fundInitCache?.value?.fundContractAddr;
})

const showInitializeTooltip = computed(() => {
  return isFundInitialized.value && step.value > 1 && step.value < 6;
});

const showButtonNext = computed(() => {
  const item = stepperEntry.value[step.value - 1];

  if(!accountStore.isConnected) return false;

  const steps = [
    OnboardingStep.Chain,
    OnboardingStep.Basics,
    OnboardingStep.Fee,
    OnboardingStep.Whitelist,
    OnboardingStep.Permissions,
    OnboardingStep.NavMethods,
  ];

  // 1. button next is available steps in "steps" array
  if (steps.includes(item.key)) {
    return true;
  }
  // 2. button next is available on governance step ONLY IF fund was initialized
  if (item.key === OnboardingStep.Governance && isFundInitialized.value) {
    return true;
  }

  return false;
});

const showInitializeButton = computed(() => {
  if (isFundInitialized.value) return false;

  const item = stepperEntry.value[step.value - 1];

  if (item.key === OnboardingStep.Governance) {
    return true;
  }
  return false;
});

const showClearCacheButton = computed(() => {
  const item = stepperEntry.value[step.value - 1];

  if (item.key === OnboardingStep.Chain && accountStore.isConnected) {
    return true;
  }
  return false;
});

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


const isCurrentStepValid = computed(() => {
  if (isFundInitialized.value) return true;

  // Basics, Fees, Management, Governance is validated here
  const stepWithRegularFields = [
    OnboardingStep.Chain,
    OnboardingStep.Basics,
    OnboardingStep.Fee,
    OnboardingStep.Governance,
  ];

  let isCurrentStepValid = false;
  const currentStep = stepperEntry.value[step.value - 1];

  if (stepWithRegularFields.includes(currentStep.key) && currentStep.fields) {
    isCurrentStepValid = currentStep.fields.every((field) => {
      // check if it's a custom value toggle
      if (field.isCustomValueToggleOn === false) return true;

      if (field.fields) {
        // check if it's toggled off
        if (!field.isToggleOn) return true;

        return field.fields.every((subField) => {
          return subField?.rules?.every((rule) => {
            if (Array.isArray(subField.value)) {
              return subField.value.every((val) => rule(val) === true);
            }
            return rule(subField.value) === true;
          });
        });

      }
      return field?.rules?.every((rule) => {
        if (Array.isArray(field.value)) {
          return field.value.every((val) => rule(val) === true);
        }
        return rule(field.value) === true;
      });
    });
  }
  // validation for whitelist
  else if (currentStep.key === OnboardingStep.Whitelist) {
    if (isWhitelistedDeposits.value) {
      isCurrentStepValid = whitelistedAddresses.value.length > 0;
    } else {
      isCurrentStepValid = true;
    }

    console.warn("FINISHED");
  }
  // validation for permissions
  else if (currentStep.key === OnboardingStep.Permissions) {
    isCurrentStepValid = true;
  }
  // validation for nav methods
  else if (currentStep.key === OnboardingStep.NavMethods) {
    isCurrentStepValid = true;
  }

  return isCurrentStepValid;
});

const allowedDepositors = computed(() => {
  if (!isWhitelistedDeposits.value) {
    return [];
  }

  return whitelistedAddresses.value
    .filter((item) => !item.deleted)
    .map((item) => item.address);
});


// Methods
// helper function to generate sections
const generateSteps = (stepperEntry: IOnboardingStep[]) => {
  return OnboardingStepMap?.map((step) => ({
    name: step?.name ?? "",
    key: step?.key ?? "",
    info: step?.info ?? "",
    fields: generateFields(step, stepperEntry),
  })) as IOnboardingStep[];
}


// helper function to generate fields
const generateFields = (step: IOnboardingStep, stepperEntry: IOnboardingStep[]) => {
  const stepKey = step.key as OnboardingInitializingSteps;

  if (!OnboardingFieldsMap[stepKey]) return [];

  const output =  OnboardingFieldsMap[stepKey]?.map((field, fieldIndex) => {
    const stepIndex = findIndexByKey(stepperEntry, stepKey);
    const isToggleOn = stepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.isToggleOn ?? field?.isToggleOn;

    if (field?.isToggleable) {
      const output = field?.fields?.map((subField, subFieldIndex) => {

        // Try to get the value from local storage, if it doesn't exist, use the default value
        const subFieldValue = stepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.fields?.[subFieldIndex]?.value;

        return {
          ...subField,
          value: subFieldValue ?? subField?.value,
        }
      });

      return {
        ...field,
        isToggleOn,
        fields: output,
      } as IFieldGroup;
    }
    const fieldTyped = field as IField;

    // Try to get the value from local storage, if it doesn't exist, use the default value
    const fieldValue = stepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.value;
    const fieldIsCustomValueToggleOn = stepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.isCustomValueToggleOn;

    return {
      ...fieldTyped,
      isCustomValueToggleOn: fieldIsCustomValueToggleOn ?? fieldTyped?.isCustomValueToggleOn,
      value: fieldValue ?? fieldTyped?.value,
    } as IField;
  });

  // find basic step and add custom fields to that step
  if (stepKey === OnboardingStep.Basics) {

    if(Object.keys(stepperEntry).length === 0) return output;

    const stepIndex = stepperEntry.findIndex(
      (step) => step.key === OnboardingStep.Basics,
    );

    if (stepIndex !== -1) {
      const stepFields = stepperEntry[stepIndex].fields ?? [];

      // find custom fields (fields that has key "isFieldByUser")
      const customFields = stepFields?.filter(
        (field) => {
          return field.isFieldByUser;
        },
      ) ?? [];

      const customFiledsFormatted = customFields?.map((field) => {
        return {
          ...field,
          rules: [formRules.required],
        };
      }) ?? [];

      return output.concat(customFiledsFormatted);
    }
  }

  return output;
}


const getFieldByStepAndFieldKey =(
  stepperEntry: IOnboardingStep[],
  stepKey: string,
  fieldKey: string,
) =>{
  const field = stepperEntry
    ?.find(step => step.key === stepKey)?.fields
    ?.flatMap(field => field.fields || field)
    ?.find(field => field.key === fieldKey);

  if (!field) {
    console.error(`Field ${fieldKey} not found in step ${stepKey}`);
    return "";
  }

  if (field?.defaultValue) {
    return field?.isCustomValueToggleOn ? field?.value : field?.defaultValue;
  }

  return field?.value;
}


const findCustomFieldsFromStep = (stepKey: string) => {
  if(Object.keys(stepperEntry).length === 0) return [];

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
  const customFIelds = findCustomFieldsFromStep(OnboardingStep.Basics);

  return  {
    description: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "description"),
    photoUrl: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "photoUrl"),
    plannedSettlementPeriod: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "plannedSettlementPeriod"),
    strategistName : getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "strategistName"),
    strategistUrl : getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "strategistUrl"),
    oivChatUrl : getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "oivChatUrl"),
    ...Object.fromEntries(customFIelds.map((field) => [field.key, field.value])),
  }
};

const getFeeValue = (feeKey: string) => {
  return toggledOffFields.value.includes(feeKey)
    ? 0
    : Number(fromPercentageToBps(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Fee, feeKey)));
};

const getFeeCollectors = (feeKey: string) => {
  return toggledOffFields.value.includes(feeKey)
    ? ethers.ZeroAddress
    : getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Fee, feeKey);
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
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "baseToken"), // baseToken
      "0x0000000000000000000000000000000000000000",
      false,
      false,
      allowedDepositors.value, // allowedDepositAddrs
      [], // allowedManagers, default empty array
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "governanceToken"), // governanceToken
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "fundName"),
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "fundSymbol"),
      formatFeeCollectors(),
    ],
    [
      parseInt(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "quorum") as string), // quorumFraction
      parseInt(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "lateQuorum") as string),
      parseInt(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "votingDelay") as string),
      parseInt(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "votingPeriod") as string),
      parseInt(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "proposalThreshold") as string),
    ],
    JSON.stringify(formatFundMetaData()),
    0, // feePerformancePeriod, default to 0
    0, // managementFeePeriod, default to 0
  ]

  console.log("output", output);
  return output;
}


const initializeFund = async() => {
  const fundChainId = selectedChainId.value;
  console.log("FUND CHAIN ID", fundChainId);

  try {
    isInitializeLoading.value = true;
    const fundFactoryContract = web3Store.chainContracts[fundChainId]?.fundFactoryContract;

    if (!fundFactoryContract) {
      return toastStore.errorToast(
        `Cannot create fund on chain ${fundChainId}.`,
      );
    }

    const formattedData = formatInitializeData();
    console.warn("SUBMIT formatted data", formattedData);


    return;

    await fundFactoryContract
      .send("initCreateFund", {}, ...formattedData)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      }).on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Fund initialization was successful. Wait for node to sync and go to next step.");
          // Start fetching fund init cache so that the user can go to next step.
          // Repeat at least 10 times until the cache is there. Wait 1 sec between each try.
          repeatUntilFundInitCacheExists(20, 1000);
        } else {
          toastStore.errorToast("Fund initialization transaction has failed. Please contact the Rethink Finance community for support.");
        }
      }).on("error", (error: any) => {
        console.error("error when initializing", error);
        isInitializeLoading.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error:any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the OIV");
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
      console.log("Cache is now available!");
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
  const lsStepperEntry = getLocalStorageItem(
    onboardingStepperEntryLocalStorageKey.value,
  ) || {} as IOnboardingStep[];

  console.log("LS whitelist", lsWhitelist);
  console.log("LS lsStepperEntry", lsStepperEntry);
  // set whitelist from local storage
  if (lsWhitelist){
    isWhitelistedDeposits.value = lsWhitelist.isWhitelistedDeposits ?? false;
    whitelistedAddresses.value = lsWhitelist.whitelistedAddresses ?? [];
  }


  return generateSteps(lsStepperEntry);
};


const saveDraftToLocalStorage = () => {
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

  toastStore.successToast("Draft saved successfully");
  handleCloseSaveChangesDialog();
};

const handleCloseSaveChangesDialog = () => {
  saveChangesDialog.value = false; // close the dialog
  if (nextRouteResolve) nextRouteResolve(); // continue navigation
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

  if (
    step.value === 1
  ) {
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

// TODO: remove this watcher
watch(stepperEntry.value, (newVal) => {
  console.log("stepperEntry changes", newVal);
});

watch(() => selectedChainId.value, () => {
  askToSaveDraftBeforeRouteLeave.value = true;
  createFundStore.setSelectedStepperChainId(selectedChainId.value);

  // clear fetched fund if we change the chain
  createFundStore.clearFundInitCache();
  stepperEntry.value = initStepperEntry();
});

watch(() => accountStore.activeAccountAddress, () => {
  console.log("Watcher: connected wallet changed fetchFundInitCache");
  if (step.value > 1) {
    stepperEntry.value = initStepperEntry();
    fetchFundInitCache();
  }
});

watch(()=> accountStore.connectedWalletChainId, (newVal, oldVal) =>{
  if(!oldVal){
    setDefaultSelectedChainId()
  }
})

// Lifecycle Hooks
onBeforeRouteLeave((to, from, next) => {
  // allow page change if user is not validated (he is seeing the password page)
  if(!isCreateFundPasswordCorrect.value) {
    next();
    return;
  }

  if (askToSaveDraftBeforeRouteLeave.value) {
    saveChangesDialog.value = true; // show the dialog
    nextRouteResolve = next; // store the resolve function for later
  } else {
    // Reset askToSaveDraftBeforeRouteLeave value.
    askToSaveDraftBeforeRouteLeave.value = true;

    if (next) next();
  }
});

const chainIdValues = computed(() => networkChoices.map((choice: any) => choice.value));

onMounted(() => {
  // Set selected chain to user's current network.
  setDefaultSelectedChainId()
});
</script>

<style scoped lang="scss">
.stepper_onboarding {
  display: flex;
  flex-direction: column;
  position: relative;

  &:deep(.v-stepper-header) {
    order: 1;
  }
  &:deep(.v-avatar){
    border: 1px solid $color-text-irrelevant;
    background-color: transparent;
    font-size: $text-md;
    font-weight: 700;
  }
  &:deep(.v-stepper-item--selected){
    font-weight: 800;
  }
  &:deep(.v-stepper-item--selected .v-avatar) {
    color: $color-primary;
    border: none;
    background-color: transparent;
  }
  &:deep(.v-stepper-item--complete .v-avatar) {
    color: $color-success;
    background-color: transparent;
  }
  &:deep(.v-stepper-actions){
    order: 2;
    padding: 1.25rem;
  }
  &:deep(.v-window){
    padding: 1.25rem;
    order: 3;
  }
}

.buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.25rem;
  margin-left: auto;
}

.tooltip {
  &__content {
    display: flex;
    gap: 40px;
  }
  &__link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    color: $color-primary;
  }
}

.connect_wallet {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  font-size: $text-md;
  color: $color-text-irrelevant;
  text-align: center;
}

.info-box{
  margin-top: 1.25rem;
}
</style>
