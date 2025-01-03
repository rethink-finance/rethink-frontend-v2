<template>
  <div :class="`field` + (isPreview ? ' label_preview' : '')" v-bind="$attrs">
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
          (Uneditable)
        </span>
      </div>
      <ui-char-limit
        v-if="field.charLimit && !isPreview"
        :char-limit="field.charLimit"
        :char-number="value"
      />
    </v-label>

    <template v-if="[InputType.Text, InputType.Number].includes(field.type)">
      <v-text-field
        v-model="value"
        :placeholder="field.placeholder"
        :type="field.type"
        :min="field.min"
        :rules="field.rules"
        :disabled="isDisabled || !field.isEditable || isPreview"
      />
    </template>

    <template v-else-if="field.type === InputType.Textarea">
      <v-textarea
        v-model="value"
        :placeholder="field.placeholder"
        :rules="field.rules"
        auto-grow
        :disabled="isDisabled || !field.isEditable || isPreview"
      />
    </template>

    <template v-else-if="field.type === InputType.Select">
      <v-select
        v-model="value"
        :rules="field.rules"
        :items="field.choices"
        item-title="title"
        item-value="value"
        class="field-select"
        :disabled="isDisabled || !field.isEditable || isPreview"
      />
    </template>

    <template v-else-if="field.type === InputType.Checkbox">
      <v-checkbox v-model="value" :disabled="isDisabled || !field.isEditable" />
    </template>

    <template v-else-if="field.type === InputType.Image">
      <div class="image_container">
        <v-avatar size="12rem" rounded="">
          <img :src="value" class="image_container__image" alt="image">
        </v-avatar>
        <v-textarea
          v-model="value"
          class="image_container__textarea"
          :placeholder="field.placeholder"
          :rules="field.rules"
          rows="10"
          :disabled="isDisabled || !field.isEditable || isPreview"
        />
      </div>
    </template>

    <InfoBox v-if="field.info && !isPreview" :info="field.info" />
  </div>
</template>

<script setup lang="ts">
import InfoBox from "./InfoBox.vue";
import { InputType } from "~/types/enums/input_type";

const emit = defineEmits(["update:modelValue"]);

const props = defineProps({
  field: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  modelValue: {
    type: [String, Number, Array, Boolean] as PropType<any>,
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
});

const isFieldRequired = computed(() =>
  props?.field?.rules?.includes(formRules.required),
);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
</script>

<style lang="scss" scoped>
.row_title {
  display: flex;
  justify-content: space-between;

  &__title {
    font-size: 16px;
    font-weight: 500;
    color: $color-text-irrelevant;

    &.label_disabled {
      color: $color-disabled;
    }
  }

  &__uneditable {
    font-size: 12px;
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
}
.v-label {
  margin-bottom: 5px;
}
.label_required {
  &__label_type {
    margin-left: 5px;
  }
}

.field-select {
  line-height: normal;

  :deep(.v-field__input) {
    padding: 12px;
    min-height: 45px;
  }
}

.image_container {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 0.2rem;

  @include sm {
    flex-direction: row;
    align-items: flex-start;
    gap: 1rem;
  }

  &__image {
    border-radius: 0.25rem;
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  &__textarea {
    width: 100%;
  }
}
</style>
