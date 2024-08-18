<template>
  <v-label class="row_title">
    <div
      :class="
        `row_title__title` +
        (isFieldRequired && field.isEditable ? ' label_required' : '') +
        (isDisabled ? ' label_disabled' : '')
      "
    >
      {{ field.label }}
      <span v-if="!field.isEditable" class="row_title__uneditable">
        (Uneditable)
      </span>
    </div>
    <ui-char-limit
      v-if="field.charLimit"
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
      :disabled="isDisabled || !field.isEditable"
    />
  </template>

  <template v-else-if="field.type === InputType.Textarea">
    <v-textarea
      v-model="value"
      :placeholder="field.placeholder"
      :rules="field.rules"
      :disabled="isDisabled || !field.isEditable"
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
      :disabled="isDisabled || !field.isEditable"
    />
  </template>

  <template v-else-if="field.type === InputType.Checkbox">
    <v-checkbox v-model="value" :disabled="isDisabled || !field.isEditable" />
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { InputType } from "~/types/enums/stepper";

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
});

const isFieldRequired = computed(() =>
  props.field.rules.includes(formRules.required)
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
}

.label_required {
  margin-bottom: 5px;

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
</style>
