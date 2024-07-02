<template>
  <div class="dirext-execution">
    <UiHeader>
      <div class="main_header__title">
        Direct Execution Proposal
        <UiTooltipClick
          tooltip-text="We can show more info text, redirect to a new page etc."
          :hide-after="3000"
        >
          <Icon
            icon="material-symbols:info-outline"
            class="main_header__info-icon"
            width="1.5rem"
            @click="redirectInfo"
          />
        </UiTooltipClick>
      </div>
    </UiHeader>
    <!-- content -->
    <UiStepper :entry="executionEntry" :fields-map="fieldsMap" />
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

const redirectInfo = () => {
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

.main_header {
  &__title {
    display: flex;
    align-items: center;
    align-content: center;
    gap: 10px;
  }

  &__info-icon {
    display: flex;
    cursor: pointer;
    color: $color-text-irrelevant;
  }
}
</style>
