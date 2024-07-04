<template>
  <div class="dirext-execution">
    <!-- Stepper with header -->
    <UiStepper
      :entry="executionEntry"
      :fields-map="fieldsMap"
      title="Direct Execution Proposal"
      tooltip-text="We can show more info text, redirect to a new page etc."
      :tooltip-click="tooltipClick"
      submit-label="Create Proposal"
      :submit-event="submitProposal"
    />
  </div>
</template>

<script setup lang="ts">
import {
  DirectExecutionFieldsMap,
  ExecutionStep,
  ExecutionStepMap,
} from "~/types/enums/direct_execution";

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

const executionEntry = ref([
  {
    stepName: ExecutionStep.Setup,
    stepLabel: ExecutionStepMap[ExecutionStep.Setup].name,
    formTitle: ExecutionStepMap[ExecutionStep.Setup].formTitle,
    formText: ExecutionStepMap[ExecutionStep.Setup].formText,

    stepDefaultValues: {
      rowTX: "",
      gasToSendWithTransaction: "",
      addressOfContractInteraction: "",
      operations: "",
    },

    multipleSteps: true,
    substepLabel: "Execution",
    steps: [
      {
        rowTX: "",
        gasToSendWithTransaction: "",
        addressOfContractInteraction: "",
        operations: "",
      },
    ] as any[],
  },
  {
    stepName: ExecutionStep.Details,
    stepLabel: ExecutionStepMap[ExecutionStep.Details].name,
    formTitle: ExecutionStepMap[ExecutionStep.Details].formTitle,

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
const fieldsMap = ref(DirectExecutionFieldsMap);

const submitProposal = () => {
  alert("submit proposal");
};

const tooltipClick = () => {
  console.log(
    "we can redirect to a new page, show a tooltip message or do whatever we want here"
  );
};

onMounted(() => {
  emit("updateBreadcrumbs", breadcrumbItems);
});
</script>

<style scoped lang="scss">
.direct-execution {
}
</style>
