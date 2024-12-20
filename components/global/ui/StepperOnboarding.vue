<template>
  <v-stepper
    ref="stepper"
    v-model="step"
    editable
    class="stepper-onboarding"
  >
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
          <v-btn
            v-if="showInitializeButton"
            color="primary"
            variant="flat"
            :loading="isInitializeLoading"
            @click="initializeDialog = true"
          >
            Initialize
          </v-btn>
          <!-- TODO: determine when to show 'Next' button -->
          <v-btn
            v-if="showButtonNext"
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
                  <!-- v-model="form[subField.key]" -->
                  <UiField
                    v-model="subField.value"
                    :field="subField"
                    :is-disabled="!field.isToggleOn"
                  />
                </v-col>
              </div>
            </div>
            <div v-else>
              <!-- v-model="form[field.key]" -->
              <UiField
                v-model="field.value"
                :field="field"
              />
            </div>
          </v-col>
        </div>

        <!-- STEP WHITELIST -->
        <div
          v-if="item.key=== OnboardingStep.Whitelist"
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
        <!-- STEP PERMISSIONS -->
        <OnboardingPermissions v-if="item.key=== OnboardingStep.Permissions" />

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
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import SectionWhitelist from "~/pages/details/[fundSlug]/governance/fund-settings/SectionWhitelist.vue";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { IWhitelist } from "~/types/enums/fund_setting_proposal";
import {
  OnboardingFieldsMap,
  OnboardingStepMap,
  OnboardingStep,
  type IField,
  type IOnboardingForm,
  type IOnboardingStep, type OnboardingStepWithoutPermissions,
} from "~/types/enums/stepper_onboarding";

const toastStore = useToastStore();
const web3Store = useWeb3Store();
const accountStore = useAccountStore();

// Data
const step = ref(1);

// TODO: add validation functionality
const saveChangesDialog = ref(false);
const initializeDialog = ref(false);
const isInitializeLoading = ref(false);
// store the resolve/reject functions for the save changes dialog
let nextRouteResolve: Function | null = null;

const form = ref<IOnboardingForm>({
  // Basics
  chainId: "0xa4b1",
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
  hurdleRate: "",
  // Whitelist
  whitelist: "",
  isWhitelistedDeposits: false,
  // Management
  plannedSettlementPeriod: "",
  minLiquidAssetShare: "",
  // Governance
  governanceToken: "",
  quorum: "", // quorumFraction
  votingPeriod: "",
  votingDelay: "",
  proposalThreshold: "",
  lateQuorum: "",

  // NAV Methods
  navMethods: "",
  // Finalise
});

const whitelist = ref<IWhitelist[]>([]);


// Computed
const showButtonNext = computed(() => {
  const item = stepperEntry.value[step.value - 1];
  console.log("item", stepperEntry.value)

  const steps = [
    OnboardingStep.Basics,
    OnboardingStep.Fees,
    OnboardingStep.Whitelist,
    OnboardingStep.Management,
    OnboardingStep.Governance,
    OnboardingStep.Permissions,
    OnboardingStep.NavMethods,
  ];

  return steps.includes(item.key);
});

const showInitializeButton = computed(() => {
  const item = stepperEntry.value[step.value - 1];

  if (item.key === OnboardingStep.Governance) {
    return true;
  }
  return false;
});


const fundInitialized = computed(() => {
  // TODO return true if fund was initialized already
  return false
})
const isStepEditable = (step: IOnboardingStep) => {
  // Disable some steps if fund was not initialized yet. User cannot change
  // permissions or NAV methods if fund was not initialized yet.
  return !(
    !fundInitialized.value &&
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


// Methods
// helper function to generate sections
const generateSteps = (form: IOnboardingForm) =>{
  console.log("generate steps", form);
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
  const stepKey = step.key as OnboardingStepWithoutPermissions;

  if (!OnboardingFieldsMap[stepKey]) return [];

  return OnboardingFieldsMap[stepKey]?.map((field, fieldIndex) => {
    if (field?.isToggleable) {
      const output = field?.fields?.map((subField) => {
        return {
          ...subField,
          value: form[subField?.key] as string,
        }
      });

      const stepIndex = findIndexByKey(stepperEntry, stepKey);
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


const formatFundMetaData = () => {
  return {
    description: form.value.description,
    photoUrl: form.value.photoUrl,
    plannedSettlementPeriod: form.value.plannedSettlementPeriod,
    minLiquidAssetShare: form.value.minLiquidAssetShare,
    // custom fields goes here
  }
};

const getFeeValue = (fee: keyof IOnboardingForm) => {
  return toggledOffFields.value.includes(fee)
    ? 0
    : parseInt(fromPercentageToBps(form.value[fee]));
};

const getFeeCollectors = (fee: keyof IOnboardingForm) => {
  return toggledOffFields.value.includes(fee)
    ? ethers.ZeroAddress
    : form.value[fee];
};

const formatFeeCollectors = () => {
  return [
    getFeeCollectors("depositFeeRecipientAddress"),
    getFeeCollectors("redemptionFeeRecipientAddress"),
    getFeeCollectors("managementFeeRecipientAddress"),
    getFeeCollectors("profitManagemnetFeeRecipientAddress"),
  ]
};


const handleInitialize = async() => {
  const fundChainId = form.value.chainId;
  try {
    isInitializeLoading.value = true;
    const fundFactoryContract = web3Store.chainContracts?.[fundChainId]?.fundFactoryContract;
    if (!fundFactoryContract) {
      return toastStore.errorToast(
        `Cannot create fund on chain ${fundChainId}.`,
      );
    }

    let allowedDepositors = [] as string[];
    if (form.value.isWhitelistedDeposits) {
      allowedDepositors = whitelist.value
        .filter((item) => !item.deleted)
        .map((item) => item.address);
    }
    // TODO: add allowedManagers to the form
    const allowedManagers = [] as string[];

    await fundFactoryContract.methods.createFund(
      [
        getFeeValue("depositFee"),// depositFee
        getFeeValue("redemptionFee"),// redemptionFee
        getFeeValue("profitManagemnetFee"),// profitManagemnetFee
        getFeeValue("managementFee"),// managementFee
        0, // performaceHurdleRateBps - Rok said it should be 0
        form.value.denominationAsset, // baseToken
        "0x0000000000000000000000000000000000000000",
        false,
        false,
        allowedDepositors, // allowedDepositAddrs
        allowedManagers, // allowedManagers
        form.value.governanceToken, // governanceToken
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        form.value.fundDAOName,
        form.value.tokenSymbol,
        formatFeeCollectors(),
      ],
      [
        parseInt(form.value.quorum), // quorumFraction
        parseInt(form.value.lateQuorum),
        parseInt(form.value.votingDelay),
        parseInt(form.value.votingPeriod),
        parseInt(form.value.proposalThreshold),
      ],
      JSON.stringify(formatFundMetaData()),
      0, // feePerformancePeriod, default to 0
      parseInt(form.value.managementFeePeriod), // feeManagePeriod
    ).send({
      from: accountStore.activeAccountAddress,
      maxFeePerGas: "",
    }).on("transactionHash", (hash: any) => {
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
      isInitializeLoading.value = false;

    }).on("error", (error: any) => {
      console.log(error);
      isInitializeLoading.value = false;
      toastStore.errorToast(
        "There has been an error. Please contact the Rethink Finance community for support.",
      );
    });
  } catch (error:any) {
    console.error(error);
    isInitializeLoading.value = false;
    toastStore.errorToast("There was an error initializing the OIV");
  } finally {
    initializeDialog.value = false;
  }
};

const initStepperEntry = () => {
  // generate stepper entry from local storage
  // TODO: here we can load fetched initialized steps as well
  const lsForm = getLocalStorageItem("onboardingForm") as IOnboardingForm;
  const lsWhitelist = getLocalStorageItem("onboardingWhitelist") as IWhitelist[];

  // set whitelist from local storage
  if (lsWhitelist.length > 0){
    whitelist.value = lsWhitelist;
  }

  // set form from local storage
  if (Object.keys(lsForm).length > 0){
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

const stepperEntry = ref(initStepperEntry());

// Watchers

watch(stepperEntry.value, (newVal) => {
  console.log("stepperEntry", newVal);
});

watch(form.value, (newVal) => {
  console.log("form", newVal);
});


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
