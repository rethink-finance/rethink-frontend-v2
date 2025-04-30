<template>
  <div class="delegated-permission">
    <UiStepper
      :entry="delegatedEntry"
      :fields-map="fieldsMap"
      :title="title"
      :submit-label="submitLabel"
      :submit-event="onSubmit"
      :is-submit-loading="isLoading"
      :always-show-last-step="alwaysShowLastStep"
      class="delegated-permission-stepper"
      @fields-changed="fieldsChanged"
    >
      <template #post-steps-content>
        <slot name="post-steps-content" />
      </template>
      <template #pre-content>
        <slot name="pre-content" />
      </template>
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
          Import Raw Permissions
        </v-btn>
      </template>
    </UiStepper>

    <UiConfirmDialog
      v-model="showAddRawDialog"
      title="Import Raw Permissions JSON"
      max-width="80%"
      confirm-text="Import Raw Permissions"
      cancel-text="Cancel"
      message="Please enter raw permissions JSON"
      @confirm="addRawProposal"
    >
      <v-textarea
        v-model="rawProposalInput"
        label="Raw proposal"
        outlined
        placeholder="Enter the raw permissions JSON here"
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
import { formatInputToObject } from "~/composables/stepper/formatInputToObject";
import { useToastStore } from "~/store/toasts/toast.store";
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  proposalRoleModMethodStepsMap,
  roleModMethodChoices,
} from "~/types/enums/delegated_permission";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import type { IRawTrx } from "~/types/zodiac-roles/role";

const toastStore = useToastStore();
const permissionsProposalStore = usePermissionsProposalStore();

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
  alwaysShowLastStep: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits([
  "update:modelValue",
  "fieldsChanged",
  "submit",
  "addRaw",
  "entryUpdated",
]);

// Local state bound to v-model
const delegatedEntry = ref(JSON.parse(JSON.stringify(props.modelValue)));

// Local State
const showAddRawDialog = ref(false);
const rawProposalInput = ref("");
const keepExistingPermissions = ref(true);
const isMounted = ref(false);

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

      // now we need to populate values from the proposal to the defaultMethodForEntry
      entry.value.forEach((value: any) => {
        const valueName = value?.name || "";
        if (!valueName) {
          console.error("Value name not found");
          return;
        }
        defaultMethodForEntry[valueName] = value?.data ?? "";
      });

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

const updateTransactionsJsonField = () => {
  if (!isMounted.value) return;

  const transactions = delegatedEntry.value.find(
    (entry: any) => entry.stepName === DelegatedStep.Setup,
  )?.steps ?? [];
  const detailsStep = delegatedEntry.value.find(
    (entry: any) => entry.stepName === DelegatedStep.Details,
  );
  if (!detailsStep) return;

  const rawTransactions: IRawTrx[] = [];
  transactions.forEach((trx: any) => {
    const trxArgs = proposalRoleModMethodStepsMap[trx.contractMethod]
      .filter((method: any) => method.key !== "contractMethod")
      .map((method: any) =>
        prepRoleModEntryInput({
          ...method,
          data: trx[method.key],
        }),
      );
    rawTransactions.push({
      funcName: trx.contractMethod,
      args: trxArgs,
    })

    permissionsProposalStore.rawTransactions = [...rawTransactions];
    detailsStep.steps[0].transactionsOverview = JSON.stringify(permissionsProposalStore.rawTransactions.map(trx => [trx.funcName, trx.args]), null, 2);
    detailsStep.steps[0].transactionsRawJSON = permissionsProposalStore.rawTransactionsJson;
  });
}
// we need to change the inputs based on the contractMethod
const fieldsChanged = (stepName: any, subStepIndex: any, step: any) => {
  updateTransactionsJsonField();
  // we need to formatInputToObject for the new substep inputs based on the contractMethod
  const newInput = formatInputToObject(
    proposalRoleModMethodStepsMap[step.contractMethod],
  );

  const mainStepIndex = delegatedEntry.value.findIndex(
    (entry: any) => entry.stepName === stepName,
  );
  if (mainStepIndex === -1) {
    console.error("Main step not found");
    return;
  }

  const currentInputs = delegatedEntry?.value?.[mainStepIndex]?.steps?.[subStepIndex];
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


onMounted(() => {
  if (permissionsProposalStore.rawTransactions.length) {
    keepExistingPermissions.value = false;
    rawProposalInput.value = permissionsProposalStore.rawTransactionsJson;
    console.log("mounted raw", rawProposalInput.value);
    addRawProposal();

    // Reset RAW transactions.
    permissionsProposalStore.rawTransactions = [];
  }
  isMounted.value = true;
});
// TODO this is not a good way to do that but the stepper and StepperFields
//  should not be implemented like that, mutating props inside but instead they
//  should be correctly emitting events. But it's a lot of refactor to fix that
//  now. This should be a v-model somehow, emitting update:modelValue
watch(
  () => delegatedEntry.value,
  (newValue) => {
    // Emit changes back to parent
    // emit("update:modelValue", newValue);
    emit("entryUpdated", newValue);
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
