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
    <div class="wizard">
      <div class="main_card wizard__main-steps">
        <div
          class="main-step"
          v-for="(step, index) in executionEntry"
          :key="index"
          :class="{ 'main-step--active': step.activeStep === activeStep }"
          @click="selectMainStep(step.activeStep)"
        >
          <div class="main-step__title">
            <div class="main-step__count">{{ index + 1 }}</div>
            {{ step.stepLabel }}
          </div>

          <div class="sub-steps" v-if="step?.steps && step?.steps.length > 0">
            <div
              class="sub-steps__sub-step"
              v-if="step.activeStep === ExecutionStep.Setup"
              v-for="(executionStep, index) in step.steps"
              :key="index"
              :class="{
                'sub-steps__sub-step--active': index === activeSubStep,
              }"
              @click="selectExecutionSubstep(index)"
            >
              <div class="sub-steps__dashed-line" />
              <div class="sub-steps__label">Execution {{ index + 1 }}</div>
              <UiDetailsButton
                small
                v-if="
                  executionEntry?.[0]?.steps &&
                  executionEntry?.[0]?.steps?.length > 1
                "
                class="sub-steps__delete-button"
                @click.stop="deleteExecutionSubstep(index)"
              >
                <v-icon icon="mdi-delete" color="error" />
              </UiDetailsButton>
            </div>
            <div class="sub-steps__add-new-step" @click="addNewExecutionStep">
              Add Execution +
            </div>
          </div>
        </div>
      </div>

      <div class="main_card wizard__step-content">
        <v-form
          ref="form"
          v-model="formIsValid"
          v-if="activeStep === ExecutionStep.Setup"
        >
          <v-row>
            <v-col>
              <strong>Set up Execution’ Actions</strong>
            </v-col>
          </v-row>

          <v-row>
            <FundGovernanceDirectExecutionFields
              :model-value="executionEntry[0]?.steps?.[activeSubStep]"
              :fields="fields"
            />
          </v-row>
        </v-form>

        <v-form v-if="activeStep === ExecutionStep.Details">
          <v-row>
            <v-col>
              <strong>Provide Proposal Information</strong>
            </v-col>
          </v-row>

          <v-row>
            <v-col>
              <v-label>Proposal Title</v-label>
              <v-text-field
                v-model="proposalTitle"
                placeholder="E.g. Proposal to change the governance"
                :rules="rules"
                required
              />

              <v-label>Proposal Description</v-label>
              <v-textarea
                v-model="proposalDescription"
                placeholder="E.g. This proposal aims to change the governance of the fund"
                :rules="rules"
                required
              />
            </v-col>
          </v-row>
        </v-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  DirectExecutionFieldsMap,
  ExecutionStep,
  ExecutionStepMap,
} from "~/types/enums/direct_execution";
import type { IExecutionEntry } from "~/types/execution_step";

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
    stepLabel: ExecutionStepMap[ExecutionStep.Setup].name,
    formTitle: ExecutionStepMap[ExecutionStep.Setup].formTitle,
    activeStep: ExecutionStep.Setup,
    multipleSteps: true,
    steps: [
      {
        rowTX: "",
        gasToSendWithTransaction: "",
        addressOfContractInteraction: "",
        operations: "",
      },
    ] as IExecutionEntry[],
  },
  {
    stepLabel: ExecutionStepMap[ExecutionStep.Details].name,
    formTitle: ExecutionStepMap[ExecutionStep.Details].formTitle,
    activeStep: ExecutionStep.Details,
    multipleSteps: false,
    // steps: [
    // {
    proposalTitle: "",
    proposalDescription: "",
    //   },
    // ],
  },
]);

// add new execution step
const addNewExecutionStep = () => {
  executionEntry?.value?.[0]?.steps?.push({
    rowTX: "",
    gasToSendWithTransaction: "",
    addressOfContractInteraction: "",
    operations: "",
  });
};

// delete execution step
const deleteExecutionSubstep = (index: number) => {
  // don't allow to delete the last step
  if (executionEntry?.value?.[0]?.steps?.length === 1) {
    return;
  }

  executionEntry?.value?.[0]?.steps?.splice(index, 1);

  // if the deleted step was the active one, set the first step as active
  if (activeSubStep.value === index) {
    activeSubStep.value = 0;
  }
};

// form validation
const formIsValid = ref(false);

const rules = [formRules.required];

const activeStep = ref(ExecutionStep.Setup);
const activeSubStep = ref(0);

// select execution step
const selectMainStep = (step: ExecutionStep) => {
  activeStep.value = step;

  // if we are on the details step, reset the substep
  if (step === ExecutionStep.Details) {
    activeSubStep.value = -1;
  }

  // if we are on the setup step and no substep is selected, select the first one
  if (step === ExecutionStep.Setup && activeSubStep.value === -1) {
    activeSubStep.value = 0;
  }
};

const selectExecutionSubstep = (index: number) => {
  activeSubStep.value = index;
};

const fields = computed(() => DirectExecutionFieldsMap[activeStep.value] || []);

// Computed properties for v-model
const proposalTitle = computed({
  get: () => executionEntry.value[1].proposalTitle ?? "",

  set: (value) => {
    executionEntry.value[1].proposalTitle = value;
  },
});

const proposalDescription = computed({
  get: () => executionEntry.value[1].proposalDescription ?? "",

  set: (value) => {
    executionEntry.value[1].proposalDescription = value;
  },
});

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

.wizard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;

  &__main-steps {
    width: 100%;
    padding: 1rem;
  }
  &__step-content {
    width: 100%;
    padding: 20px;
  }

  @include md {
    flex-direction: row;

    &__main-steps {
      width: 30%;
      padding: 1rem;
    }
    &__step-content {
      width: 70%;
      padding: 20px;
    }
  }
}

.main-step {
  margin-bottom: 1.5rem;
  padding: 0.75rem;

  background-color: $color-gray-light-transparent;
  @include borderGray;

  &:last-of-type {
    margin-bottom: 0;
  }

  // active state
  &--active {
    box-shadow: 0px 0px 16px 0px $color-box-shadow;
    .main-step__count {
      color: $color-primary;
      border: none;
    }
  }

  &__title {
    font-weight: 700;
    cursor: pointer;
  }
  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    height: 1.5rem;
    width: 1.5rem;
    margin-right: 0.25rem;

    @include borderGray;
    border-radius: 50%;
  }
}

.sub-steps {
  margin: 1.5rem 0 0;

  &__sub-step {
    display: flex;
    margin: 0 1rem;

    margin-bottom: 0.5rem;

    cursor: pointer;

    &:last-of-type {
      margin-bottom: 0;
    }

    // active state
    &--active {
      .sub-steps__label {
        font-weight: 700;
      }
    }
  }

  &__delete-button {
    background-color: $color-gray-light-transparent;
    border: none;
    border-top-left-radius: unset;
    border-bottom-left-radius: unset;

    transition: background-color 0.3s ease;

    &:hover {
      background-color: $color-moonlight-light;
    }
  }

  &__dashed-line {
    height: 25px;
    width: 1rem;
    border-bottom: 0.5px dashed $color-steel-blue;
    border-left: 0.5px dashed $color-steel-blue;
    border-radius: 3px;
    margin-bottom: 0.5rem;
  }

  &__label {
    padding: 0.5rem;
    width: 100%;
    background-color: $color-gray-light-transparent;
  }

  &__add-new-step {
    margin: 1rem 1rem 0;
    padding: 0.5rem;
    font-size: $text-sm;
    color: $color-text-irrelevant;
    cursor: pointer;
    user-select: none;
    text-align: center;

    transition: background-color 0.3s ease;
  }

  &__add-new-step:hover {
    background-color: $color-gray-light-transparent;
  }
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
