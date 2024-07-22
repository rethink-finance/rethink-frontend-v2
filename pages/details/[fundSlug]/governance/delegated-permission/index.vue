<template>
  <div class="delegated-permission">
    <!-- Stepper with header -->
    <UiStepper
      :entry="delegatedEntry"
      :fields-map="fieldsMap"
      title="Delegated Permissions Proposal"
      tooltip-text="We can show more info text, redirect to a new page etc."
      submit-label="Create Proposal"
      :submit-event="submitProposal"
      :is-submit-loading="loading"
      @fields-changed="contractMethodChanged"
    />
  </div>
</template>

<script setup lang="ts">
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap,
  allSubSteps,
} from "~/types/enums/delegated_permission";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";
import { useFundsStore } from "~/store/funds.store";
import { useWeb3Store } from "~/store/web3.store";
import { useToastStore } from "~/store/toast.store";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);
const loading = ref(false);

const fundStore = useFundStore();
const fundsStore = useFundsStore();
const web3Store = useWeb3Store();
const toastStore = useToastStore();
const { selectedFundSlug } = toRefs(useFundStore());
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
];

// format substeps for the stepper
const allSubStepsFormatted = allSubSteps;
console.log("ALL", allSubSteps);

const delegatedEntry = ref([
  {
    stepName: DelegatedStep.Setup,
    stepLabel: DelegatedStepMap[DelegatedStep.Setup].name,
    formTitle: DelegatedStepMap[DelegatedStep.Setup].formTitle,
    formText: DelegatedStepMap[DelegatedStep.Setup].formText,

    // default value when adding a new sub step
    stepDefaultValues: formatInputToObject(allSubStepsFormatted.scopeFunction),

    subStepKey: "contractMethod",
    multipleSteps: true,
    subStepLabel: "Permission",
    // default values for the first sub step
    steps: [formatInputToObject(allSubStepsFormatted.scopeFunction)],
  },
  {
    stepName: DelegatedStep.Details,
    stepLabel: DelegatedStepMap[DelegatedStep.Details].name,
    formTitle: DelegatedStepMap[DelegatedStep.Details].formTitle,
    multipleSteps: false,
    stepDefaultValues: {
      proposalTitle: "",
      proposalDescription: "",
    },
    steps: [
      {
        proposalTitle: "",
        proposalDescription: "",
      },
    ],
  },
]);

const fieldsMap = ref(DelegatedPermissionFieldsMap);

function formatArrayToObject(array: { [key: string]: any }[]): any {
  const result: any = {};

  array.forEach((item) => {
    const functionName = Object.keys(item)[0];
    result[functionName] = item[functionName];
  });

  return result;
}

function formatInputToObject(input: any) {
  /*
  input parameter is an actual function ABI from the RolesFull.json RoleMod contract.
   */
  const result = {} as any;
  console.log("input: ", input);

  input?.forEach((item: any) => {
    const { key, type, isArray } = item;
    let value;

    // Determine the default value based on the type
    switch (type) {
      case "number":
        value = "";
        break;
      case "text":
        value = "";
        break;
      case "select":
        value = item.defaultValue;
        break;
      case "checkbox":
        value = false;
        break;
      default:
        value = "";
    }

    // If the field is an array, we need to wrap the value in an array
    if (isArray) {
      value = [value];
    }

    result[key] = value;
  });

  return result;
}

// we need to change the inputs based on the contractMethod
const contractMethodChanged = (
  mainStepName: any,
  subStepIndex: any,
  step: any,
) => {
  // console.log("mainStepName: ", mainStepName);
  // console.log("subStepIndex: ", subStepIndex);
  // console.log("step: ", step);

  // we need to formatInputToObject for the new substep inputs based on the contractMethod
  const newInput = formatInputToObject(
    allSubStepsFormatted[step.contractMethod],
  );
  newInput.isValid = false;

  const mainStepIndex = delegatedEntry.value.findIndex(
    (entry) => entry.stepName === mainStepName,
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
  const hasSameKeys = Object.keys(currentInputs).every(
    (key) => key in newInput,
  );
  if (hasSameKeys) {
    return;
  }

  keysToDelete.forEach((key) => {
    delete currentInputs[key];
  });

  Object.assign(currentInputs, newInput); // add new input to the current inputs
};

const submitProposal = () => {
  const transactions = delegatedEntry.value.find(step => step.stepName === DelegatedStep.Setup)?.steps as any[];
  const details = delegatedEntry.value.find(step => step.stepName === DelegatedStep.Details)?.steps[0];
  if (!web3Store.web3 || !details || !transactions?.length) return;

  console.log(transactions);
  console.log(details);
};

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
</style>
