<template>
  <div class="d-flex" style="width: 100%; flex-direction: column">
    <v-stepper
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
          :editable="isStepEditable(item)"
        >
          <template #default>
            <span>{{ item.name }}</span>
          </template>
        </v-stepper-item>
      </v-stepper-header>

      <v-stepper-actions>
        <template #next>
          <div class="buttons">
            <!-- TODO: determine when to show 'Skip' button -->
            <!-- TODO: determine onClick behavior for 'Skip' button -->
            <!-- <v-btn
              v-if="step !== stepperEntry.length"
              variant="text"
              @click="step = stepperEntry.length"
            >
              Skip
            </v-btn> -->
            <div class="item">
              <v-tooltip
                activator="parent"
                location="bottom"
                :disabled="isCurrentStepValid"
              >
                <template #activator="{ props }">
                  <v-btn
                    v-if="showButtonNext"
                    :disabled="!isCurrentStepValid"
                    @click="step++"
                  >
                    Next
                  </v-btn>
                </template>
                <template #default>
                  Please fill out all required fields
                </template>
              </v-tooltip></div>

            <v-btn
              v-if="showInitializeButton"
              color="primary"
              variant="flat"
              :loading="isInitializeLoading"
              @click="initializeDialog = true"
            >
              Initialize
            </v-btn>
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

      <v-window v-model="step">
        <v-window-item
          v-for="(item, stepIndex) in stepperEntry"
          :key="stepIndex"
          :value="stepIndex + 1"
        >
          <div v-if="item.hasRegularFields" class="fields">
            <v-col
              v-for="(field, index) in item.fields"
              :key="index"
              :cols="field?.cols ?? 12"
            >
              <div v-if="field.isToggleable" class="toggleable_group">
                <div class="toggleable_group__toggle">
                  <v-switch
                    v-model="field.isToggleOn"
                    color="primary"
                    hide-details
                  />
                </div>

                <div class="fields">
                  <v-col
                    v-for="(subField, subFieldIndex) in field.fields"
                    :key="subFieldIndex"
                    :cols="subField?.cols ?? 6"
                  >
                    <UiField
                      v-model="subField.value"
                      :field="subField"
                      :is-disabled="!field.isToggleOn"
                    />
                  </v-col>
                </div>
              </div>
              <div v-else>
                <UiField
                  v-model="field.value"
                  :field="field"
                />
              </div>
            </v-col>
          </div>

          <!-- STEP WHITELIST -->
          <OnboardingWhitelist
            v-if="item.key === OnboardingStep.Whitelist"
            :ls-whitelist="whitelist"
            :is-disabled="isFundInitialized"
            :ls-is-whitelisted-deposits="isWhitelistedDeposits"
            @update-items="handleWhitelistChange"
            @update-is-whitelisted-deposits="isWhitelistedDeposits = $event"
          />

          <!-- STEP PERMISSIONS -->
          <OnboardingPermissions
            v-if="item.key=== OnboardingStep.Permissions"
          />

          <!-- STEP NAV METHODS -->
          <div
            v-if="item.key === OnboardingStep.NavMethods"
          >
            This might be a component instead of regular fields
          </div>

          <!-- STEP FINALISE -->
          <div
            v-if="item.key === OnboardingStep.Finalise"
            class="step step__finalise"
          >
            <p>
              After finalising the setup users will be able to deposit into your OIV.
            </p>
            <p>
              Please note that any future change after finalisation will go through governance.
            </p>

            <v-btn
              color="primary"
              @click="finalizeFundCreation"
            >
              Finalise
            </v-btn>
          </div>
        </v-window-item>
      </v-window>


      <UiConfirmDialog
        v-model="saveChangesDialog"
        title="Heads Up!"
        confirm-text="Save"
        cancel-text="Don't save"
        message="Do you want to save the changes?"
        class="confirm_dialog"
        max-width="600px"
        @confirm="handleSaveChanges"
        @cancel="handleCloseSaveChangesDialog"
      />

      <UiConfirmDialog
        v-model="initializeDialog"
        title="Heads Up!"
        confirm-text="Initialize"
        message="You will not be able to change the OIV settings after you initialize it. Changes will require governance proposal."
        class="confirm_dialog"
        max-width="600px"
        :loading="isInitializeLoading"
        @confirm="handleInitialize"
        @cancel="initializeDialog = false"
      />
    </v-stepper>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { computed } from "vue";
import { useAccountStore } from "~/store/account/account.store";
import { useCreateFundStore } from "~/store/create-fund/createFund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useActionStateStore } from "~/store/actionState.store";

import type { IWhitelist } from "~/types/enums/fund_setting_proposal";
import {
  OnboardingFieldsMap,
  OnboardingStep,
  OnboardingStepMap,
  type IField,
  type IOnboardingForm,
  type IOnboardingStep, type OnboardingInitializingSteps,
} from "~/types/enums/stepper_onboarding";
import { ActionState } from "~/types/enums/action_state";

const toastStore = useToastStore();
const actionStateStore = useActionStateStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();
const createFundStore = useCreateFundStore();

// Data
const { chainId, fundInitCache } = toRefs(createFundStore);
// TODO set step back to 1
const step = ref(1);

// TODO: add validation functionality
const saveChangesDialog = ref(false);
const initializeDialog = ref(false);
const isInitializeLoading = ref(false);
// store the resolve/reject functions for the save changes dialog
let nextRouteResolve: Function | null = null;

// whitelist data
const whitelist = ref<IWhitelist[]>([]);
const isWhitelistedDeposits = ref(false);

// Fetch Fund Cache and fill the form data with the fetched fund cache.
const fetchFundCache = async () => {
  if (accountStore.activeAccountAddress) {
    // TODO make use of loading spinner to lock form while fetching data
    await createFundStore.fetchFundCacheAction(chainId.value, accountStore.activeAccountAddress);
    // TODO fill form data from the fetched fund cache
  }
}
const isLoadingFetchFundCache = computed(() =>
  actionStateStore.isActionState(
    "fetchFundCache",
    ActionState.Loading,
  ),
);

onMounted(() => {
  fetchFundCache();
});

watch(() => accountStore.activeAccountAddress, () => {
  console.log("Watcher: connected wallet changed fetchFundCache");
  fetchFundCache();
});

// Computed
const isFundInitialized = computed(() => {
  // Return true if fund was initialized already
  return !!fundInitCache?.value?.fundContractAddr;
})

const showButtonNext = computed(() => {
  const item = stepperEntry.value[step.value - 1];

  const steps = [
    OnboardingStep.Basics,
    OnboardingStep.Fees,
    OnboardingStep.Whitelist,
    OnboardingStep.Management,
    OnboardingStep.Permissions,
    OnboardingStep.NavMethods,
  ];

  // 1. button next is available steps in "steps" array
  if(steps.includes(item.key)) {
    return true;
  }

  console.log("isFundInitialized", isFundInitialized.value);
  console.log("item.key === OnboardingStep.Governance", item.key === OnboardingStep.Governance);
  // 2. button next is available on governance step ONLY IF fund was initialized
  if (item.key === OnboardingStep.Governance && isFundInitialized.value) {
    return true;
  }

  return false;
});

const showInitializeButton = computed(() => {
  const item = stepperEntry.value[step.value - 1];

  if (item.key === OnboardingStep.Governance) {
    return true;
  }
  return false;
});

const isStepEditable = (step: IOnboardingStep) => {
  // Disable some steps if fund was not initialized yet. User cannot change
  // permissions or NAV methods if fund was not initialized yet.
  if (isLoadingFetchFundCache.value) return false;

  return !(
    !isFundInitialized.value &&
    [OnboardingStep.Permissions,
      OnboardingStep.NavMethods,
      OnboardingStep.Finalise,
    ].includes(step.key)
  );
}


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
  // TODO: here we want to check which step are we on and validate the fields
  // Basics, Fees, Management, Governance is validatet here
  const stepWithRegularFields = [
    OnboardingStep.Basics,
    OnboardingStep.Fees,
    OnboardingStep.Management,
    OnboardingStep.Governance,
  ];

  let isCurrentStepValid = false;
  const currentStep = stepperEntry.value[step.value - 1];


  if(stepWithRegularFields.includes(currentStep.key) && currentStep.fields) {
    isCurrentStepValid =  currentStep.fields.every((field) => {
      if (field.fields) {
        // check if its toggled off
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
      isCurrentStepValid = whitelist.value.length > 0;
    } else {
      isCurrentStepValid = true;
    }
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


// Methods
// helper function to generate sections
const generateSteps = () => {
  return OnboardingStepMap?.map((step) => ({
    name: step?.name ?? "",
    key: step?.key ?? "",
    info: step?.info ?? "",
    hasRegularFields: step?.hasRegularFields ?? false,
    fields: generateFields(step),
  })) as IOnboardingStep[];
}


// helper function to generate fields
const generateFields = (step: IOnboardingStep) => {
  const lsStepperEntry = getLocalStorageItem("onboardingStepperEntry") || [] as IOnboardingStep[];
  const stepKey = step.key as OnboardingInitializingSteps;

  if (!OnboardingFieldsMap[stepKey]) return [];

  return OnboardingFieldsMap[stepKey]?.map((field, fieldIndex) => {
    const stepIndex = findIndexByKey(lsStepperEntry, stepKey);
    const isToggleOn = lsStepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.isToggleOn ?? field?.isToggleOn;

    if (field?.isToggleable) {
      const output = field?.fields?.map((subField, subFieldIndex) => {

        // Try to get the value from local storage, if it doesn't exist, use the default value
        const lsSubFieldValue = lsStepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.fields?.[subFieldIndex]?.value;
        const subFieldValue = lsSubFieldValue ?? subField?.value;

        return {
          ...subField,
          value: subFieldValue,
        }
      });

      return {
        ...field,
        isToggleOn,
        fields: output,
      };
    }
    const fieldTyped = field as IField;

    // Try to get the value from local storage, if it doesn't exist, use the default value
    const lsFieldValue = lsStepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.value;
    const fieldValue = lsFieldValue ?? fieldTyped?.value;

    return {
      ...fieldTyped,
      value: fieldValue,
    } as IField;
  });
}

const handleWhitelistChange = (items: IWhitelist[]) => {
  whitelist.value = items;
};

const finalizeFundCreation = () => {
  console.warn("finalizeFundCreation", stepperEntry.value);
};


const getFieldByStepAndFieldKey = (stepperEntry: IOnboardingStep[], stepKey:string, fieldKey:string) => {
  return stepperEntry
    ?.find(step => step.key === stepKey)?.fields
    ?.flatMap(field => field.fields || field)
    ?.find(field => field.key === fieldKey)?.value || "";
}


const formatFundMetaData = () => {
  return {
    description: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "description"),
    photoUrl: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "photoUrl"),
    plannedSettlementPeriod: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Management, "plannedSettlementPeriod"),
    minLiquidAssetShare: getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Management, "minLiquidAssetShare"),

    // description: form.value.description,
    // photoUrl: form.value.photoUrl,
    // plannedSettlementPeriod: form.value.plannedSettlementPeriod,
    // minLiquidAssetShare: form.value.minLiquidAssetShare,
    // custom fields goes here
  }
};

const getFeeValue = (fee: keyof IOnboardingForm) => {
  return toggledOffFields.value.includes(fee)
    ? 0
    : parseInt(fromPercentageToBps(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Fees, fee)));
};

const getFeeCollectors = (fee: keyof IOnboardingForm) => {
  return toggledOffFields.value.includes(fee)
    ? ethers.ZeroAddress
    : getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Fees, fee);
};

const formatFeeCollectors = () => {
  return [
    getFeeCollectors("depositFeeRecipientAddress"),
    getFeeCollectors("redemptionFeeRecipientAddress"),
    getFeeCollectors("managementFeeRecipientAddress"),
    getFeeCollectors("profitManagemnetFeeRecipientAddress"),
  ]
};

const allowedDepositors = computed(() => {
  if (!isWhitelistedDeposits.value) {
    return [];
  }

  return whitelist.value
    .filter((item) => !item.deleted)
    .map((item) => item.address);
});


const formatInitializeData = () => {
  const output = [
    [
      getFeeValue("depositFee"),// depositFee
      getFeeValue("redemptionFee"),// redemptionFee
      getFeeValue("profitManagemnetFee"),// profitManagemnetFee
      getFeeValue("managementFee"),// managementFee
      0, // performaceHurdleRateBps, default to 0
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "denominationAsset"), // baseToken
      "0x0000000000000000000000000000000000000000",
      false,
      false,
      allowedDepositors.value, // allowedDepositAddrs
      [], // allowedManagers, default empty array
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Governance, "governanceToken"), // governanceToken
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "fundDAOName"),
      getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "tokenSymbol"),
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
    parseInt(getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Fees, "managementFeePeriod") as string), // feeManagePeriod
  ]

  console.log("output", output);
  return output;
}


const handleInitialize = async() => {
  // const fundChainId = form.value.chainId;
  const fundChainId = getFieldByStepAndFieldKey(stepperEntry.value, OnboardingStep.Basics, "chainId") as string;

  try {
    isInitializeLoading.value = true;
    const fundFactoryContract = web3Store.chainContracts[fundChainId]?.fundFactoryContract;

    if (!fundFactoryContract) {
      return toastStore.errorToast(
        `Cannot create fund on chain ${fundChainId}.`,
      );
    }

    const formattedData = formatInitializeData();
    console.log("SUBMIT formatted data", formattedData);

    await fundFactoryContract
      .send("createFund", {}, ...formattedData)
      .on("transactionHash", (hash: any) => {
        console.log("tx hash: " + hash);
        toastStore.addToast(
          "The transaction has been submitted. Please wait for it to be confirmed.",
        );
      }).on("receipt", (receipt: any) => {
        console.log("receipt: ", receipt);
        if (receipt.status) {
          toastStore.successToast("Create Fund transaction was successful.");

        } else {
          toastStore.errorToast("The Create Fund tx has failed. Please contact the Rethink Finance community for support.");
        }

      }).on("error", (error: any) => {
        console.log(error);
        isInitializeLoading.value = false;
        toastStore.errorToast(
          "There has been an error. Please contact the Rethink Finance community for support.",
        );
      });
  } catch (error:any) {
    console.error(error);
    toastStore.errorToast("There was an error initializing the OIV");
  } finally {
    initializeDialog.value = false;
    isInitializeLoading.value = false;
  }
};

const initStepperEntry = () => {
  // generate stepper entry from local storage
  // TODO: here we can load fetched initialized steps as well
  const lsWhitelist = getLocalStorageItem("onboardingWhitelist");

  console.log("LS whitelist", lsWhitelist);
  // set whitelist from local storage
  if (lsWhitelist){
    isWhitelistedDeposits.value = lsWhitelist.isWhitelistedDeposits ?? false;
    whitelist.value = lsWhitelist.whitelist ?? [];
  }

  return generateSteps();
};

const handleSaveChanges = () => {
  setLocalStorageItem("onboardingStepperEntry", stepperEntry.value);
  // save whitelist data to local storage
  const whitelistData ={
    whitelist: whitelist.value,
    isWhitelistedDeposits: isWhitelistedDeposits.value,
  }
  setLocalStorageItem("onboardingWhitelist", whitelistData);

  toastStore.successToast("Draft saved successfully");

  handleCloseSaveChangesDialog();
};

const handleCloseSaveChangesDialog = () => {
  saveChangesDialog.value = false; // close the dialog
  if (nextRouteResolve) nextRouteResolve(); // continue navigation

};

const stepperEntry = ref(initStepperEntry());

// Watchers
watch(stepperEntry.value, (newVal) => {
  console.log("stepperEntry", newVal);
});

// Lifecycle Hooks
onBeforeRouteLeave((to, from, next) => {
  saveChangesDialog.value = true; // show the dialog
  nextRouteResolve = next; // store the resolve function for later
});
</script>

<style scoped lang="scss">
.stepper_onboarding {
  display: flex;
  flex-direction: column;
  position: relative;

  &:deep(.v-stepper-header){
    order: 1;
  }
  &:deep(.v-avatar){
    border: 1px solid $color-text-irrelevant;
    background-color: transparent;
    font-size: 16px;
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
    padding: 20px;
  }
  &:deep(.v-window){
    padding: 20px;
    order: 3;
  }
}

.buttons{
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;

  margin-left: auto;
}


.toggleable_group {
  display: flex;
  flex-direction: column;

  &__toggle {
    display: flex;
    justify-content: flex-end;
    margin-left: auto;
  }
}

.fields {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
}

.section-whitelist {
  display: none;
  padding: 20px;

  &.toggle__on {
    display: block;
  }
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

.step{
  padding-block: 30px;

  &__finalise{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
}
</style>
