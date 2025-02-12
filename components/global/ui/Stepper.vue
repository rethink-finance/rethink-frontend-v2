<template>
  <section class="section-stepper">
    <UiHeader>
      <div class="main_header__title">
        {{ title }}
        <slot name="subtitle" />
      </div>

      <div class="buttons">
        <slot name="buttons" />
        <v-btn
          class="button--primary"
          :type="isLastStep ? 'submit' : 'button'"
          :loading="isSubmitLoading"
          :disabled="isLastStep && !accountStore.isConnected"
          @click="handleButtonClick"
        >
          {{ isLastStep ? submitLabel : "Next" }}
          <v-tooltip
            v-if="isLastStep && !accountStore.isConnected"
            :model-value="true"
            activator="parent"
            location="top"
            @update:model-value="true"
          >
            <!-- class="tooltip" -->
            Connect your wallet to create a proposal.
          </v-tooltip>
        </v-btn>
      </div>
    </UiHeader>

    <div class="stepper">
      <div class="main_card stepper__main-steps">
        <div
          v-for="(step, mainStepIndex) in entry"
          :key="mainStepIndex"
          class="main-step"
          :class="mainStepClasses(step)"
        >
          <div class="main-step__title" @click="selectMainStep(step.stepName)">
            <div class="main-step__count">
              {{ mainStepIndex + 1 }}
            </div>
            {{ step.stepLabel }}
          </div>

          <div v-if="step.multipleSteps" class="sub-steps">
            <div
              v-for="(substep, substepIndex) in step.steps"
              :key="substepIndex"
              class="sub-steps__sub-step"
              :class="{
                'sub-steps__sub-step--active':
                  substepIndex === activeSubStep &&
                  step.stepName === activeMainStep,
              }"
              @click="selectSubStep(step, substepIndex)"
            >
              <div class="sub-steps__dashed-line" />
              <div class="sub-steps__label">
                {{ substep[step.subStepKey] ?? (step.subStepLabel + " " + (substepIndex + 1)) }}
              </div>

              <div class="sub-steps__icons">
                <UiDetailsButton
                  v-if="
                    step.steps &&
                      step.steps?.length > 1 &&
                      substepIndex === activeSubStep &&
                      step.stepName === activeMainStep
                  "
                  small
                  class="sub-steps__delete-button"
                  @click.stop="deleteSubstep(step, substepIndex)"
                >
                  <v-icon icon="mdi-delete" color="error" />
                </UiDetailsButton>
                <div v-else class="sub-steps__feedback-icons">
                  <Icon
                    v-if="substep.isValid === false"
                    icon="weui:error-outlined"
                    width="1rem"
                    class="sub-steps__icon error"
                  />
                  <Icon
                    v-else-if="substep.isValid === true"
                    icon="material-symbols:check-circle-outline"
                    width="1rem"
                    class="sub-steps__icon success"
                  />
                </div>
              </div>
            </div>
            <div
              v-if="step.stepName === activeMainStep"
              class="sub-steps__add-new-step"
              @click="addNewSubstep(step)"
            >
              Add {{ step.subStepLabel }} +
            </div>
          </div>
        </div>
        <slot name="post-steps-content" />
      </div>

      <div class="main_card stepper__step-content">
        <slot name="pre-content" />

        <v-form ref="form">
          <div
            v-for="(step, index) in entry"
            :key="index"
            class="form__content"
          >
            <v-row v-if="step.stepName === activeMainStep">
              <UiStepperFields
                :model-value="step?.steps?.[activeSubStep]"
                :fields="fields"
                :title="step.formTitle"
                :text="step.formText"
                @validate="checkIfEveryFieldIsValid"
              />
            </v-row>
          </div>
        </v-form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";
const toastStore = useToastStore();
const accountStore = useAccountStore();

const emit = defineEmits(["fields-changed"]);

const props = defineProps({
  entry: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  fieldsMap: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  title: {
    type: String,
    default: "",
  },
  tooltipText: {
    type: String,
    default: "",
  },
  tooltipClick: {
    type: Function,
    default: () => {},
  },
  submitLabel: {
    type: String,
    default: "Submit",
  },
  submitEvent: {
    type: Function,
    default: () => {},
  },
  isSubmitLoading: {
    type: Boolean,
    default: false,
  },
  alwaysShowLastStep: {
    type: Boolean,
    default: false,
  },
});

// define the form ref
const form = ref();

// form validation
const formIsValid = ref(false);

// get step names from the entry
const stepNames = props.entry.map((step) => step.stepName);
// active step
const activeMainStep = ref(stepNames[0]);
const activeSubStep = ref(0);

// this f-n will be used to get the active substep name in case of dynamic fields
// it will be used to get the fields for the active substep based on the substep key
const activeSubstepName = computed(() => {
  const { steps, subStepKey } = props.entry.find(
    (step) => step.stepName === activeMainStep.value,
  ) as any;

  return steps[activeSubStep.value][subStepKey];
});

const fields = computed(
  // in case subStepKey is provided, get the fields based on the substep key
  // otherwise get the fields based on the active substep
  () => {
    if (activeSubstepName.value) {
      // we need to change entry field values based on the active substep
      const activeSubstep = props.entry.find(
        (step) => step.stepName === activeMainStep.value,
      )?.steps?.[activeSubStep.value];

      emit(
        "fields-changed",
        activeMainStep.value,
        activeSubStep.value,
        activeSubstep,
      );

      return (
        props.fieldsMap[activeMainStep.value][activeSubstepName.value] || []
      );
    }
    return props.fieldsMap[activeMainStep.value] || [];
  },
);

const isLastStep = computed(() => {
  if (props.alwaysShowLastStep) return true;
  return (
    activeMainStep.value === stepNames[stepNames.length - 1] &&
    activeSubStep.value ===
      props.entry?.[stepNames.length - 1]?.steps?.length - 1
  );
});

// main step classes
const mainStepClasses = (step: any) => {
  return [
    { "main-step--active": activeMainStep.value === step.stepName },
    {
      "main-step--error": step.steps.some(
        (substep: any) => substep.isValid === false,
      ),
    },
    {
      "main-step--success": step.steps.every(
        (substep: any) => substep.isValid === true,
      ),
    },
  ];
};

// select main step
const selectMainStep = (step: string) => {
  if (activeMainStep.value === step) return;
  activeMainStep.value = step;
  activeSubStep.value = 0;
};

const selectSubStep = (mainStep: any, index: number) => {
  activeMainStep.value = mainStep.stepName;
  activeSubStep.value = index;
};

// add new sub step
const addNewSubstep = (mainStep: any) => {
  activeMainStep.value = mainStep.stepName;

  const mainStepIndex = props.entry.findIndex(
    (step) => step.stepName === mainStep.stepName,
  );

  // sub step to add
  const newSubStep = JSON.parse(
    JSON.stringify(props.entry?.[mainStepIndex]?.stepDefaultValues),
  );

  props.entry?.[mainStepIndex]?.steps?.push(newSubStep);

  // set new step as active
  activeSubStep.value = props.entry?.[mainStepIndex]?.steps?.length - 1;
  activeMainStep.value = mainStep.stepName;
};

// delete sub step
const deleteSubstep = (mainStep: any, index: number) => {
  const mainStepIndex = props.entry.findIndex(
    (step) => step.stepName === mainStep.stepName,
  );

  // don't allow to delete if there is only one step
  if (props.entry?.[mainStepIndex]?.steps?.length === 1) {
    return;
  }

  props.entry?.[mainStepIndex]?.steps?.splice(index, 1);

  // if deleted step was a last step, set the previous step as active
  if (activeSubStep.value === props.entry?.[mainStepIndex]?.steps?.length) {
    activeSubStep.value = props.entry?.[mainStepIndex]?.steps?.length - 1;
  }
};

// check if all main steps and substeps are valid
const checkIfEveryFieldIsValid = () => {
  const isValid = props.entry.map((step) => {
    return step.steps.every((substep: any) => {
      return substep.isValid === true;
    });
  });

  formIsValid.value = isValid.every((step) => step === true);
};

const handleButtonClick = () => {
  isLastStep.value ? submit() : nextStep();
};

const submit = () => {
  if (formIsValid.value) {
    props.submitEvent();
  } else {
    form.value?.validate();
    toastStore.warningToast("Please fill all the required fields");
  }
};

const nextStep = () => {
  const mainStepIndex = props.entry.findIndex(
    (step) => step.stepName === activeMainStep.value,
  );

  if (activeSubStep.value === props.entry?.[mainStepIndex]?.steps?.length - 1) {
    const nextMainStepIndex = stepNames.indexOf(activeMainStep.value) + 1;
    activeMainStep.value = stepNames[nextMainStepIndex];
    activeSubStep.value = 0;
  } else {
    activeSubStep.value = activeSubStep.value + 1;
  }
};
</script>

<style scoped lang="scss">
.main_header {
  &__title {
    display: flex;
    align-items: center;
    align-content: center;
    gap: 20px;
  }
}
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

.buttons{
  display: flex;
  gap: 1rem;
  align-items: center;
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

  // error state
  &--error {
    .main-step__count {
      color: $color-error;
    }
  }
  // success state
  &--success {
    .main-step__count {
      color: $color-success;
    }
  }

  &__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
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

    &__prefix {
      overflow: hidden;
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
    word-break: break-all;
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

    &:hover {
      background-color: $color-gray-light-transparent;
    }
  }

  &__icons {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    background-color: $color-gray-light-transparent;
  }

  &__icon {
    &:only-child {
      margin-left: auto;
      margin-right: 0.5rem;
    }

    &.error {
      color: $color-error;
    }

    &.success {
      color: $color-success;
    }
  }
}
</style>
