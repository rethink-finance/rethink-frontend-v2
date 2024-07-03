<template>
  <section class="section-stepper">
    <UiHeader>
      <div class="main_header__title">
        {{ title }}
        <UiTooltipClick
          v-if="tooltipText"
          :tooltip-text="tooltipText"
          :hide-after="3000"
        >
          <Icon
            icon="material-symbols:info-outline"
            class="main_header__info-icon"
            width="1.5rem"
            @click="tooltipClick"
          />
        </UiTooltipClick>
      </div>

      <v-btn
        class="button--primary"
        :type="isLastStep ? 'submit' : 'button'"
        @click="handleButtonClick"
      >
        {{ isLastStep ? submitLabel : "Next" }}
      </v-btn>
    </UiHeader>

    <div class="stepper">
      <div class="main_card stepper__main-steps">
        <div
          v-for="(step, index) in entry"
          :key="index"
          class="main-step"
          :class="{ 'main-step--active': step.stepName === activeMainStep }"
        >
          <div class="main-step__title" @click="selectMainStep(step.stepName)">
            <div class="main-step__count">
              {{ index + 1 }}
            </div>
            {{ step.stepLabel }}
          </div>

          <div v-if="step.multipleSteps" class="sub-steps">
            <div
              v-for="(substep, index) in step.steps"
              :key="index"
              class="sub-steps__sub-step"
              :class="{
                'sub-steps__sub-step--active':
                  index === activeSubStep && step.stepName === activeMainStep,
              }"
              @click="selectSubStep(step, index)"
            >
              <div class="sub-steps__dashed-line" />
              <div class="sub-steps__label">
                {{ step.substepLabel }}
                {{ index + 1 }}
              </div>

              <UiDetailsButton
                v-if="
                  step.steps &&
                    step.steps?.length > 1 &&
                    index === activeSubStep &&
                    step.stepName === activeMainStep
                "
                small
                class="sub-steps__delete-button"
                @click.stop="deleteSubstep(step, index)"
              >
                <v-icon icon="mdi-delete" color="error" />
              </UiDetailsButton>
            </div>
            <div
              v-if="step.stepName === activeMainStep"
              class="sub-steps__add-new-step"
              @click="addNewSubstep(step)"
            >
              Add {{ step.substepLabel }} +
            </div>
          </div>
        </div>
      </div>

      <div class="main_card stepper__step-content">
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
                @validate="validate"
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
import { type FieldsMapType } from "~/types/enums/stepper";

import { useToastStore } from "~/store/toast.store";
const toastStore = useToastStore();

const props = defineProps({
  entry: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  fieldsMap: {
    type: Object as PropType<FieldsMapType>,
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

const fields = computed(() => props.fieldsMap[activeMainStep.value] || []);
const isLastStep = computed(() => {
  return !!(
    activeMainStep.value === stepNames[stepNames.length - 1] &&
    activeSubStep.value ===
      props.entry?.[stepNames.length - 1]?.steps?.length - 1
  );
});

// select main step
const selectMainStep = (step: string) => {
  if (activeMainStep.value === step) return;
  activeMainStep.value = step;
  activeSubStep.value = 0;
};

const selectSubStep = (mainStep: any, index: number) => {
  const mainStepIndex = props.entry.findIndex(
    (step) => step.stepName === mainStep.stepName,
  );

  activeMainStep.value = mainStep.stepName;
  activeSubStep.value = index;
};

// add new sub step
const addNewSubstep = (mainStep: any) => {
  activeMainStep.value = mainStep.stepName;

  const mainStepIndex = props.entry.findIndex(
    (step) => step.stepName === mainStep.stepName,
  );

  props.entry?.[mainStepIndex]?.steps?.push({
    ...props.entry?.[mainStepIndex]?.stepDefaultValues,
  });

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
const validate = () => {
  const isValid = props.entry.map((step) => {
    return step.steps.every((substep: any) => {
      return substep.isValid === true;
    });
  });

  console.log("isValid", isValid);

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
    gap: 10px;
  }

  &__info-icon {
    display: flex;
    cursor: pointer;
    color: $color-text-irrelevant;
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
