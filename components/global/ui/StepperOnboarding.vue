<template>
  <v-stepper
    ref="stepper"
    v-model="step"
    class="stepper-onboarding"
  >
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
          <!-- TODO: determine when to show 'Skip' button -->
          <!-- TODO: determine onClick behavior for 'Skip' button -->
          <!-- <v-btn
            v-if="step !== stepperEntry.length"
            variant="text"
            @click="step = stepperEntry.length"
          >
            Skip
          </v-btn> -->
          <!-- TODO: determine when to show 'Next' button -->
          <v-btn
            v-if="showButtonNext"
            @click="step++"
          >
            Next
          </v-btn>
        </div>

        <v-btn
          v-if="showInitializeButton"
          color="primary"
          variant="flat"
          @click="handleInitialize"
        >
          Initialize
        </v-btn>
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
                  v-for="(subField, index) in field.fields"
                  :key="index"
                  :cols="subField?.cols ?? 6"
                >
                  <UiField
                    v-model="form[subField.key]"
                    :field="subField"
                    :is-disabled="!field.isToggleOn"
                  />
                </v-col>
              </div>
            </div>
            <div v-else>
              <UiField
                v-model="form[field.key]"
                :field="field"
              />
            </div>
          </v-col>
        </div>

        <!-- STEP WHITELIST -->
        <div
          v-if="item.key=== OnboardingSteps.Whitelist"
        >
          <div
            class="toggleable_group__toggle"
          >
            <v-switch
              v-model="form.isWhitelistedDeposits"
              color="primary"
              hide-details
            />
          </div>

          <SectionWhitelist
            v-if="form.isWhitelistedDeposits"
            :items="whitelist"
            @update-items="handleWhitelistChange"
          />
          <div v-else>
            <UiInfoBox
              class="info-box"
              info="Whitelist is disabled. This means that anyone can deposit into the OIV. <br>
                      If you want to enable the whitelist, please toggle the switch above. <br>
                      Whitelist is a list of addresses that are allowed to deposit into the OIV."
            />
          </div>
        </div>

        <!-- STEP NAV METHODS -->
        <div
          v-if="item.key === OnboardingSteps.NavMethods"
        >
          This might be a component instead of regular fields
        </div>
        <!-- STEP FINALISE -->
        <div
          v-if="item.key === OnboardingSteps.Finalise"
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
            @click="submitForm"
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
  </v-stepper>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";

import SectionWhitelist from "~/pages/details/[fundSlug]/governance/fund-settings/SectionWhitelist.vue";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";
import {
  OnboardingFieldsMap,
  OnboardingStepMap,
  OnboardingSteps,
  type IField,
  type IOnboardingForm,
  type IOnboardingStep,
} from "~/types/enums/stepper_onboarding";


const toastStore = useToastStore();

// Props
// const props = defineProps({

// })

// Data
const step = ref(1);
// TODO: add validation functionality
const isCurrentStepValid = ref(true);
const saveChangesDialog = ref(false);
// store the resolve/reject functions for the save changes dialog
let nextRouteResolve: Function | null = null;

const form = ref<IOnboardingForm>({
  // Basics
  photoUrl: "",
  fundDAOName: "",
  tokenSymbol: "",
  denominationAsset: "",
  description: "",
  // Fees
  depositFee: "",
  depositFeeRecipientAddress: "",
  redemptionFee: "",
  redemptionFeeRecipientAddress: "",
  managementFee: "",
  managementFeeRecipientAddress: "",
  managementFeePeriod: "",
  profitManagemnetFee: "",
  profitManagemnetFeeRecipientAddress: "",
  profitManagementFeePeriod: "",
  hurdleRate: "",
  // Whitelist
  whitelist: "",
  isWhitelistedDeposits: false,
  // Management
  plannedSettlementPeriod: "",
  minLiquidAssetShare: "",
  // Governance
  governanceToken: "",
  quorum: "",
  votingPeriod: "",
  votingDelay: "",
  proposalThreshold: "",
  lateQuorum: "",
  // Permissions
  permissions: "",
  // Navigation Methods
  navMethods: "",
  // Finalise
});

const whitelist = ref<IWhitelist[]>([]);


// Computeds
const showButtonNext =computed(() => {
  const item = stepperEntry.value[step.value - 1];

  const steps = [
    OnboardingSteps.Basics,
    OnboardingSteps.Fees,
    OnboardingSteps.Whitelist,
    OnboardingSteps.Management,
    OnboardingSteps.Permissions,
    OnboardingSteps.NavMethods,
  ];

  return steps.includes(item.key);
});

const showInitializeButton = computed(() => {
  const item = stepperEntry.value[step.value - 1];

  if (item.key === OnboardingSteps.Governance) {
    return true;
  }
  return false;
});

// Methods
// helper function to generate sections
const generateSteps = (form: IOnboardingForm) =>{
  return OnboardingStepMap?.map((step) => ({
    name: step?.name ?? "",
    key: step?.key ?? "",
    info: step?.info ?? "",
    hasRegularFields: step?.hasRegularFields ?? false,
    fields: generateFields(step, form),
  })) as IOnboardingStep[];
}



// helper function to generate fields
const generateFields = (step: IOnboardingStep, form: IOnboardingForm) =>{
  const stepperEntry = getLocalStorageItem("onboardingStepperEntry") || [] as IOnboardingStep[];

  return OnboardingFieldsMap?.[step.key]?.map((field, fieldIndex) => {
    if (field?.isToggleable) {
      const output = field?.fields?.map((subField) => {
        return {
          ...subField,
          value: form[subField?.key] as string,
        }
      });

      const stepIndex = findIndexByKey(stepperEntry, step.key);
      const isToggleOn = stepperEntry?.[stepIndex]?.fields?.[fieldIndex]?.isToggleOn ?? field?.isToggleOn;

      return {
        ...field,
        isToggleOn,
        fields: output,
      };
    }
    const fieldTyped = field as IField;
    return {
      ...fieldTyped,
      value: form[fieldTyped.key] as string,
    } as IField;
  });
}

const handleWhitelistChange = (items: IWhitelist[]) => {
  whitelist.value = items;
};

const submitForm = () => {
  console.log("Form submitted", form.value);
  alert("Form submitted");
};

const handleInitialize = () => {
  console.log("Initialize button clicked");
  alert("Initialize button clicked");
};

const handleStepperEntry = () => {
  // generate stepper entry from local storage
  // TODO: here we can load fetched initialized steps as well
  const lsForm = getLocalStorageItem("onboardingForm") as IOnboardingForm;
  const lsWhitelist = getLocalStorageItem("onboardingWhitelist") as IWhitelist[];

  // set whitelist from local storage
  if(lsWhitelist.length > 0){
    whitelist.value = lsWhitelist;
  }

  // set form from local storage
  if(Object.keys(lsForm).length > 0){
    form.value = lsForm;
  }

  return generateSteps(form.value);
};

const handleSaveChanges = () => {
  setLocalStorageItem("onboardingStepperEntry", stepperEntry.value);
  setLocalStorageItem("onboardingForm", form.value);
  setLocalStorageItem("onboardingWhitelist", whitelist.value);
  toastStore.successToast("Draft saved successfully");

  handleCloseSaveChangesDialog();
};

const handleCloseSaveChangesDialog = () => {
  saveChangesDialog.value = false; // close the dialog
  if (nextRouteResolve) nextRouteResolve(); // continue navigation

};

const stepperEntry = ref(handleStepperEntry());

// Watchers


// Lifecycle Hooks
onBeforeRouteLeave((to, from, next) => {
  saveChangesDialog.value = true; // show the dialog
  nextRouteResolve = next; // store the resolve function for later
});
</script>

<style scoped lang="scss">
.stepper-onboarding {
    display: flex;
    flex-direction: column;

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
