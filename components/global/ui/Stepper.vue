<template>
  <div class="stepper">
    <div class="main_card stepper__main-steps">
      <div
        class="main-step"
        v-for="(step, index) in entry"
        :key="index"
        :class="{ 'main-step--active': step.stepName === activeMainStep }"
        @click="selectMainStep(step.stepName)"
      >
        <div class="main-step__title">
          <div class="main-step__count">{{ index + 1 }}</div>
          {{ step.stepLabel }}
        </div>

        <div class="sub-steps" v-if="step.multipleSteps">
          <div
            class="sub-steps__sub-step"
            v-for="(substep, index) in step.steps"
            :key="index"
            :class="{
              'sub-steps__sub-step--active': index === activeSubStep,
            }"
            @click="selectSubStep(index)"
          >
            <div class="sub-steps__dashed-line" />
            <div class="sub-steps__label">
              {{ step.substepLabel }}
              {{ index + 1 }}
            </div>

            <UiDetailsButton
              v-if="step.steps && step.steps?.length > 1"
              small
              class="sub-steps__delete-button"
              @click.stop="deleteSubstep(index)"
            >
              <v-icon icon="mdi-delete" color="error" />
            </UiDetailsButton>
          </div>
          <div class="sub-steps__add-new-step" @click="addNewSubstep(step)">
            Add {{ step.substepLabel }} +
          </div>
        </div>
      </div>
    </div>

    <div class="main_card stepper__step-content">
      <v-form ref="form" v-model="formIsValid">
        <div class="form__content" v-for="(step, index) in entry" :key="index">
          <div class="wrapper" v-if="activeMainStep === step.stepName">
            <v-row>
              <v-col>
                <strong>{{ step.formTitle }}</strong>
              </v-col>
            </v-row>

            <v-row>
              <FundGovernanceDirectExecutionFields
                :model-value="step?.steps?.[activeSubStep]"
                :fields="fields"
              />
            </v-row>
          </div>
        </div>
      </v-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type FieldsMapType } from "~/types/enums/direct_execution";

const props = defineProps({
  entry: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  fieldsMap: {
    type: Object as PropType<FieldsMapType>,
    default: () => [],
  },
});

const fields = computed(() => props.fieldsMap[activeMainStep.value] || []);

console.log("FIELDS: ", fields);

// add new sub step
const addNewSubstep = (step: any) => {
  const activeMainStepIndex = props.entry.findIndex(
    (step) => step.stepName === activeMainStep.value
  );

  props.entry?.[activeMainStepIndex]?.steps?.push({
    ...props.entry?.[activeMainStepIndex]?.stepDefaultValues,
  });
};

// delete sub step
const deleteSubstep = (index: number) => {
  const activeMainStepIndex = props.entry.findIndex(
    (step) => step.stepName === activeMainStep.value
  );

  // don't allow to delete if there is only one step
  if (props.entry?.[activeMainStepIndex]?.steps?.length === 1) {
    return;
  }

  props.entry?.[activeMainStepIndex]?.steps?.splice(index, 1);

  // if the deleted step was the active one, set the first step as active
  if (activeSubStep.value === index) {
    activeSubStep.value = 0;
  }

  // if deleted step doesn't exist anymore, set the last one as active
  if (
    activeSubStep.value >= props.entry?.[activeMainStepIndex]?.steps?.length
  ) {
    activeSubStep.value = props.entry?.[activeMainStepIndex]?.steps?.length - 1;
  }
};

// form validation
const formIsValid = ref(false);
const rules = [formRules.required];

// get step names from the entry
const stepNames = props.entry.map((step) => step.stepName);

const activeMainStep = ref(stepNames[0]);
const activeSubStep = ref(0);

// select main step
const selectMainStep = (step: string) => {
  if (activeMainStep.value === step) return;
  activeMainStep.value = step;
  activeSubStep.value = 0;
};

const selectSubStep = (index: number) => {
  activeSubStep.value = index;
};

// Computed properties for v-model
const proposalTitle = computed({
  get: () => props.entry[1].steps[0].proposalTitle ?? "",

  set: (value) => {
    props.entry[1].steps[0].proposalTitle = value;
  },
});

const proposalDescription = computed({
  get: () => props.entry[1].steps[0].proposalDescription ?? "",

  set: (value) => {
    props.entry[1].steps[0].proposalDescription = value;
  },
});

const redirectInfo = () => {
  console.log(
    "we can redirect to a new page, show a tooltip message or do whatever we want here"
  );
};
</script>

<style scoped lang="scss">
.stepper {
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
    border-radius: 1px;
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
</style>
