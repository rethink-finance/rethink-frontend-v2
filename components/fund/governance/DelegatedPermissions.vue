<template>
  <div class="delegated-permission">
    <UiStepper
      :entry="delegatedEntry"
      :fields-map="fieldsMap"
      :title="title"
      :submit-label="submitLabel"
      :submit-event="onSubmit"
      :is-submit-loading="isLoading"
      class="delegated-permission-stepper"
      @fields-changed="fieldsChanged"
    >
      <template #subtitle>
        <UiTooltipClick location="right" :hide-after="6000">
          <Icon
            icon="material-symbols:info-outline"
            class="info-icon"
            width="1.5rem"
          />
          <template #tooltip>
            <div class="tooltip__content">
              <a
                class="tooltip__link"
                href="https://docs.rethink.finance/rethink.finance"
                target="_blank"
              >
                Learn More
                <Icon icon="maki:arrow" color="primary" width="1rem" />
              </a>
            </div>
          </template>
        </UiTooltipClick>
      </template>
      <template #buttons>
        <v-btn
          class="text-secondary me-4"
          variant="outlined"
          @click="openAddRawDialog"
        >
          Add Raw
        </v-btn>
      </template>
    </UiStepper>

    <UiConfirmDialog
      v-model="showAddRawDialog"
      title="Add Raw Proposal"
      max-width="80%"
      confirm-text="Load"
      message="Please enter the raw proposal JSON below"
      @confirm="addRawProposal"
    >
      <v-textarea
        v-model="rawProposalInput"
        label="Raw proposal"
        outlined
        placeholder="Enter the raw proposal here"
        rows="20"
        class="raw-method-textarea"
      />
      <v-checkbox
        v-model="keepExistingPermissions"
        label="Keep existing permissions"
        class="checkbox-keep-existing-permissions"
      />
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  proposalRoleModMethodStepsMap,
  roleModMethodChoices,
} from "~/types/enums/delegated_permission";
import { useFundStore } from "~/store/fund/fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();
// Props
const props = defineProps({
  modelValue: { type: Array, required: true }, // Enables v-model for entry
  title: { type: String, default: "Delegated Permissions Proposal" },
  fieldsMap: { type: Object, default: () => DelegatedPermissionFieldsMap },
  submitLabel: { type: String, default: "Submit" },
  isLoading: { type: Boolean, default: false },
  tooltipTitle: {
    type: String,
    default: "Create a Delegated Permission Proposal",
  },
  tooltipLink: { type: String, default: "#" },
});

// Emits
const emit = defineEmits([
  "update:modelValue",
  "fieldsChanged",
  "submit",
  "addRaw",
]);

// Local state bound to v-model
const delegatedEntry = ref(JSON.parse(JSON.stringify(props.modelValue)));

// Local State
const showAddRawDialog = ref(false);
const rawProposalInput = ref("");
const keepExistingPermissions = ref(true);

// Methods
const openAddRawDialog = () => (showAddRawDialog.value = true);


const addRawProposal = () => {
  try {
    const proposal = JSON.parse(rawProposalInput.value);
    if (!proposal) {
      throw new Error("Invalid JSON");
    }
    console.log("proposal:", proposal)

    // format new entries from proposal and roleModMethodChoices
    const newEntries = [] as any[];

    proposal.forEach((entry: any) => {
      const contractMethod = roleModMethodChoices.find(
        (choice) => choice.valueMethodIdx === entry.valueMethodIdx,
      );

      if (!contractMethod?.value) {
        console.error("Contract method not found");
        return;
      }

      // we need to define new method entry based on the contractMethod
      const defaultMethodForEntry = formatInputToObject(
        proposalRoleModMethodStepsMap[contractMethod.value],
      );
      const currentField =
        props.fieldsMap?.setup?.[defaultMethodForEntry.contractMethod];

      console.log("contractMethod.value", contractMethod.value);
      console.log("currentField", currentField);
      console.log("currentField", props?.fieldsMap);
      console.log("defaultMethodForEntry.contractMethod", defaultMethodForEntry.contractMethod);
      // now we need to populate values from the proposal to the defaultMethodForEntry
      entry.value.forEach((value: any) => {
        const valueName = value?.name || "";
        if (!valueName) {
          console.error("Value name not found");
          return;
        }
        defaultMethodForEntry[valueName] = value?.data || "";
      });
      console.log("defaultMethodForEntry", defaultMethodForEntry);
      console.log("currentField", currentField);

      defaultMethodForEntry.isValid = validateFields(
        defaultMethodForEntry,
        currentField,
      );

      const newEntry = JSON.parse(JSON.stringify(defaultMethodForEntry));
      newEntries.push(newEntry);
    });

    const mainStepIndex = delegatedEntry.value.findIndex(
      (entry: any) => entry.stepName === DelegatedStep.Setup,
    );
    if (mainStepIndex === -1) {
      console.error("Main step not found");
      return;
    }

    if (!keepExistingPermissions.value) {
      delegatedEntry.value[mainStepIndex].steps = newEntries;
    } else {
      delegatedEntry.value[mainStepIndex].steps.push(...newEntries);
    }
    showAddRawDialog.value = false;
    rawProposalInput.value = "";
    toastStore.successToast("Raw proposal added successfully");
  } catch (e) {
    console.error(e);
    toastStore.errorToast("Failed to add raw proposal. Invalid JSON format.");
  }
};

// Validation logic
const validateFields = (entry: any, fields: any) => {
  let isValid = true;

  fields.forEach((field: any) => {
    const { key, rules = [] } = field;
    const value = entry[key];

    rules.forEach((rule: any) => {
      if (Array.isArray(value)) {
        isValid = value.every((val) => rule(val) === true);
      } else {
        isValid = rule(value) === true;
      }
    });
  });

  return isValid;
};

const onSubmit = () => emit("submit");

// we need to change the inputs based on the contractMethod
const fieldsChanged = (mainStepName: any, subStepIndex: any, step: any) => {
  // we need to formatInputToObject for the new substep inputs based on the contractMethod
  const newInput = formatInputToObject(
    proposalRoleModMethodStepsMap[step.contractMethod],
  );

  const mainStepIndex = delegatedEntry.value.findIndex(
    (entry: any) => entry.stepName === mainStepName,
  );
  if (mainStepIndex === -1) {
    console.error("Main step not found");
    return;
  }

  const currentInputs = delegatedEntry.value[mainStepIndex].steps[subStepIndex];
  if (!currentInputs) {
    console.error("Substep not found");
    return;
  }

  const keysToDelete = Object.keys(currentInputs).filter(
    (key) => key !== "contractMethod",
  );

  // check if currentInputs has the same keys as newInput
  // if it does, we don't need to do anything
  const hasSameKeys = Object.keys(newInput).every(
    (key) => key in currentInputs,
  );
  // check if "isValid" key is NOT present in the currentInputs
  if (!Object.hasOwn(currentInputs, "isValid")) {
    currentInputs.isValid = false;
  }
  if (hasSameKeys) {
    return;
  }

  keysToDelete.forEach((key) => {
    delete currentInputs[key];
  });

  Object.assign(currentInputs, newInput); // add new input to the current inputs
};

// Watchers
watch(
  () => props.modelValue,
  (newValue) => {
    // Sync changes from parent
    delegatedEntry.value = JSON.parse(JSON.stringify(newValue));
  },
);

watch(
  () => delegatedEntry,
  (newValue) => {
    // Emit changes back to parent
    emit("update:modelValue", newValue);
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.delegated-permission-stepper {
  :deep(.main_header__title) {
    width: 100%;
  }
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 70%;
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

.info-icon {
  cursor: pointer;
  display: flex;
  color: $color-text-irrelevant;
}
.checkbox-keep-existing-permissions {
  display: flex;
  flex-direction: row-reverse;

  :deep(.v-selection-control) {
    flex-direction: row-reverse;
  }
}
</style>
