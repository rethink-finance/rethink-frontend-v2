<template>
  <div :class="classes" v-bind="$attrs">

    <div class="field-actions-container" tabindex="-1">
      <v-label
        tabindex="-1"
        :class="
          `row_title` +
            (field.type === InputType.Image ? ' row_title__is-image' : '')
        "
      >
        <div
          :class="
            `row_title__title` +
              (isFieldRequired && field.isEditable && !isPreview
                ? ' label_required'
                : '') +
              (isDisabled && !isPreview ? ' label_disabled' : '')
          "
        >
          {{ field.label }}
          <span
            v-if="!field.isEditable && !isPreview"
            class="row_title__small"
          >
            (readonly)
          </span>
          <span
            v-if="field.tag"
            class="row_title__small"
          >
            ({{ field.tag }})
          </span>
        </div>
        <UiCharLimit
          v-if="field.charLimit && !isPreview"
          :char-limit="field.charLimit"
          :char-number="fieldValue"
          tabindex="-1"
        />

        <v-tooltip v-if="field?.tooltip" location="top" tabindex="-1">
          <template #activator="{ props }">
            <Icon
              v-bind="props"
              icon="octicon:question-16"
              width="1.25rem"
              class="row_title__tooltip"
              tabindex="-1"
            />
          </template>
          {{ field.tooltip }}
        </v-tooltip>
      </v-label>

      <!-- toggle for default value and custom value -->
      <v-switch
        v-if="!isInputDisabled && isCustomValueToggleOn !== undefined"
        v-model="isCustomValueActive"
        color="primary"
        :tabindex="tabIndex"
        hide-details
      />
    </div>

    <div>
      <div class="field-input">
        <template v-if="field.defaultValueInfo">
          <UiInfoBox :info="field.defaultValueInfo" />
        </template>
        <UiFieldInput
          v-if="!(isCustomValueToggleOn !== undefined && !isCustomValueToggleOn)"
          v-model="fieldValue"
          :field="field"
          :is-disabled="isInputDisabled"
          :is-preview="isPreview"
          :custom-error-message="customErrorMessage"
          :chain-id="chainId"
          :tab-index="tabIndex"
        />
      </div>
    </div>

    <InfoBox v-if="field.info && !isPreview" :info="field.info" class="info_box" />
  </div>
</template>

<script setup lang="ts">
import InfoBox from "./InfoBox.vue";
import type { ChainId } from "~/types/enums/chain_id";
import { defaultInputTypeValue, InputType } from "~/types/enums/input_type";

const emit = defineEmits([
  "update:modelValue",
  "update:isCustomValueToggleOn",
]);
defineOptions({
  inheritAttrs: false,
});
const props = defineProps({
  // chainId is required for time to blocks component
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  field: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  modelValue: {
    type: [String, Number, Array, Boolean] as PropType<any>,
    default: undefined,
  },
  isCustomValueToggleOn: {
    type: Boolean,
    default: undefined,
  },
  customErrorMessage: {
    type: String,
    default: () => "",
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showDefaultValueInfo: {
    type: Boolean,
    default: false,
  },
  initialValue: {
    type: [String, Number, Array, Boolean] as PropType<any>,
    default: undefined,
  },
  tabIndex: {
    type: Number,
    default: undefined,
  },
});

const isFieldRequired = computed(() =>
  props?.field?.rules?.includes(formRules.required),
);

const isInputDisabled = computed(() =>
  props.isDisabled || !props.field.isEditable || props.isPreview,
);

const isCustomValueActive = computed({
  get: () => props.isCustomValueToggleOn,
  set: (val) => emit("update:isCustomValueToggleOn", val),
});

const fieldValue = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

watchEffect(() => {
  // If defaultValue is set to null, return undefined as we want it to be empty.
  if (props.field?.defaultValue === null || props.modelValue != null) return;
  if (props.field?.type === InputType.Period) {
    console.warn("[Field.vue] field", props.field);
  }

  // Else return set default value or if it does not exist, just return field's default type value.
  fieldValue.value = props.field?.defaultValue ?? defaultInputTypeValue[props.field?.type as InputType];
});

const isFieldModified = computed(() => {
  if (props.initialValue === undefined) return false;

  return fieldValue.value !== props.initialValue;
});

const classes = computed(() => {
  return [
    "field",
    { label_preview: props.isPreview },
    { is_modified: isFieldModified.value },
  ]
});

</script>

<style lang="scss" scoped>
.field-actions-container{
  display: flex;
  gap: 40px;
}
.row_title {
  display: flex;
  justify-content: space-between;

  &__title {
    font-size: $text-md;
    font-weight: 500;
    color: $color-text-irrelevant;

    &.label_disabled {
      color: $color-disabled;

      // make required label color same as disabled label
      &.label_required {
        &::after {
            color: $color-disabled;
        }
      }
    }
  }
  &__small {
    font-size: $text-xs;
  }

  &__tooltip{
    margin-left: .5rem;
    cursor: pointer;

    transition: color 0.3s ease;

    &:hover {
      color: $color-primary;
    }
    &:focus {
      outline: none;
    }
  }

  &__is-image {
    margin-left: 0;
    @include sm {
      margin-left: 13rem;
    }
  }
}

.field {
  &.label_preview {
    :deep(.v-field) {
      color: $color-text-irrelevant;
      opacity: 1;
    }
  }
  &.is_modified {
    :deep(.v-field__input) {
      color: var(--color-success);
    }
  }
}
.v-label {
  margin-bottom: 5px;
}
.label_required {
  &__label_type {
    margin-left: 5px;
  }
}

.info_box{
  margin-bottom: 3rem;
}
</style>
