<template>
  <div :class="classes" v-bind="$attrs">

    <div class="field-actions-container">
      <v-label
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
            class="row_title__uneditable"
          >
            (readonly)
          </span>
        </div>
        <ui-char-limit
          v-if="field.charLimit && !isPreview"
          :char-limit="field.charLimit"
          :char-number="fieldValue"
        />
      </v-label>

      <!-- toggle for default value and custom value -->
      <v-switch
        v-if="hasDefaultValue && !isInputDisabled"
        v-model="isCustomValueActive"
        color="primary"
        hide-details
      />
    </div>

    <!--
      there are two types of fields:
      1. fields with default value
      2. fields without default value
    -->

    <!--
      1. fields with default value
      - if the toggle is on, show the custom value input
      - if the toggle is off, show the default value input or the default value info
    -->
    <div v-if="hasDefaultValue && !isInputDisabled" class="field-with-toggle">
      <template v-if="isCustomValueActive">
        <!-- Custom value input -->
        <div class="field-input">
          <FieldInput
            v-model="fieldValue"
            :field="field"
            :is-disabled="isInputDisabled"
            :is-preview="isPreview"
            :custom-error-message="customErrorMessage"
            :chain-id="chainId"
          />
        </div>
      </template>
      <template v-else>
        <!-- Default value input -->
        <div class="field-input default-value">
          <template v-if="field.defaultValueInfo">
            <UiInfoBox :info="field.defaultValueInfo" />
          </template>
          <template v-else>
            <FieldInput
              v-model="defaultValue"
              :field="field"
              :is-disabled="isInputDisabled"
              :is-preview="isPreview"
              :custom-error-message="customErrorMessage"
              :chain-id="chainId"
            />
          </template>
        </div>
      </template>
    </div>

    <!--
        2. fields without default value
        - show the regular field input without toggle
     -->
    <template v-else>
      <FieldInput
        v-model="fieldValue"
        :field="field"
        :is-disabled="isInputDisabled"
        :is-preview="isPreview"
        :custom-error-message="customErrorMessage"
        :chain-id="chainId"
      />
    </template>

    <InfoBox v-if="field.info && !isPreview" :info="field.info" />
  </div>
</template>

<script setup lang="ts">
import type { ChainId } from "~/store/web3/networksMap";
import { InputType } from "~/types/enums/input_type";
import FieldInput from "./FieldInput.vue";
import InfoBox from "./InfoBox.vue";

const emit = defineEmits(["update:modelValue", "update:isCustomValueToggleOn", "update:defaultValue"]);

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
    default: () => "",
  },
  defaultValue: {
    type: [String, Number, Array, Boolean] as PropType<any>,
    default: () => "",
  },
  isCustomValueToggleOn: {
    type: Boolean,
    default: false,
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
});

const isFieldRequired = computed(() =>
  props?.field?.rules?.includes(formRules.required),
);

const hasDefaultValue = computed(() => {
  return props?.defaultValue;
});
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

const defaultValue = computed({
  get: () => props.defaultValue,
  set: (val) => emit("update:defaultValue", val),
});

const isFieldModified = computed(() => {
  if(props.initialValue === undefined) return false;

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
  &__uneditable {
    font-size: $text-xs;
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

</style>
