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
          <v-btn
            v-if="step !== stepperEntry.length"
            variant="text"
            @click="step = stepperEntry.length"
          >
            Skip
          </v-btn>
          <!-- TODO: determine when to show 'Next' button -->
          <v-btn
            v-if="step !== stepperEntry.length"
            @click="step++"
          >
            Next
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
                  v-for="(subField, index) in field.fields"
                  :key="index"
                  :cols="subField?.cols ?? 6"
                >
                  <UiField
                    v-model="form[subField.key]"
                    :field="subField"
                    :is-disabled="false"
                  />
                </v-col>
              </div>
            </div>
            <div v-else>
              <UiField
                v-model="form[field.key]"
                :field="field"
                :is-disabled="false"
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
            @update-items="whitelist = $event"
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
  </v-stepper>
</template>

<script setup lang="ts">
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

// Props
// const props = defineProps({

// })

// Data
const step = ref(1);
// TODO: add validation functionality
const isCurrentStepValid = ref(true);

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

// Methods
// helper function to generate sections
const generateSteps = (form: IOnboardingForm) =>{
  return OnboardingStepMap?.map((step) => ({
    name: step?.name ?? "",
    key: step?.key ?? "",
    info: step?.info ?? "",
    hasRegularFields: step?.hasRegularFields ?? false,
    fields: generateFields(step, form),
  })) as { name: string; key: OnboardingSteps, fields: IField[]; info?: string; hasRegularFields: boolean }[];
}

// helper function to generate fields
const generateFields = (step: IOnboardingStep, form: IOnboardingForm) =>{
  return OnboardingFieldsMap?.[step.key]?.map((field) => {
    if (field?.isToggleable) {
      const output = field?.fields?.map((subField) => ({
        ...subField,
        value: form[subField?.key] as string,
      }));

      return {
        ...field,
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

const submitForm = () => {
  console.log("Form submitted", form.value);
  alert("Form submitted");
};

const stepperEntry = ref(generateSteps(form.value));

// Watchers


// Lifecycle Hooks
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
