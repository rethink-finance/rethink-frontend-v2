<template>
  <div class="delegated-permission">
    <!-- Stepper with header -->
    <UiStepper
      :entry="delegatedEntry"
      :fields-map="fieldsMap"
      title="Delegated Permissions Proposal"
      tooltip-text="We can show more info text, redirect to a new page etc."
      :tooltip-click="tooltipClick"
      submit-label="Create Proposal"
      :submit-event="submitProposal"
    />
  </div>
</template>

<script setup lang="ts">
import {
  DelegatedPermissionFieldsMap,
  DelegatedStep,
  DelegatedStepMap,
  allSubsteps,
  substepChoices,
} from "~/types/enums/delegated_permission";

import type BreadcrumbItem from "~/types/ui/breadcrumb";
// fund store
import { useFundStore } from "~/store/fund.store";

// emits
const emit = defineEmits(["updateBreadcrumbs"]);

const { selectedFundSlug } = toRefs(useFundStore());
const breadcrumbItems: BreadcrumbItem[] = [
  {
    title: "Governance",
    disabled: false,
    to: `/details/${selectedFundSlug.value}/governance`,
  },
];

// format substeps for the stepper
const allSubstepsFormatted = formatArrayToObject(allSubsteps);

const delegatedEntry = ref([
  {
    stepName: DelegatedStep.Setup,
    stepLabel: DelegatedStepMap[DelegatedStep.Setup].name,
    formTitle: DelegatedStepMap[DelegatedStep.Setup].formTitle,
    formText: DelegatedStepMap[DelegatedStep.Setup].formText,

    stepDefaultValues: {
      ...formatInputToObject(allSubstepsFormatted.allowTarget), // default value when adding a new substep
    },
    substepKey: "contractMethod",
    multipleSteps: true,
    substepLabel: "Permission",
    steps: [{ ...formatInputToObject(allSubstepsFormatted.allowTarget) }], // default values for the first substep
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
    const key = Object.keys(item)[0];
    result[key] = item[key];
  });

  return result;
}

function formatInputToObject(input: any) {
  const result = {} as any;

  input?.forEach((item: any) => {
    const { key, type } = item;
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
        value = substepChoices[0].value; // default value for select
        break;
      default:
        value = "";
    }

    result[key] = value;
  }) || {};

  console.log("result: ", result);

  return result;
}

const submitProposal = () => {
  alert("submit proposal");
  console.log("delegatedEntry: ", delegatedEntry.value);
};

const tooltipClick = () => {
  console.log(
    "we can redirect to a new page, show a tooltip message or do whatever we want here",
  );
};

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
.delegated-permission {
}
</style>
