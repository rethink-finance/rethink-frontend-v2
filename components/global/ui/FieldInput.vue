<template>
  <div class="field-input">
    <template v-if="[InputType.Text, InputType.Number].includes(field.type)">
      <v-text-field
        v-model="value"
        :placeholder="field.placeholder"
        :type="field.type"
        :min="field.min"
        :rules="field.rules"
        :disabled="isDisabled"
        :error-messages="errorMessages"
      />
    </template>

    <template v-else-if="field.type === InputType.Textarea">
      <v-textarea
        v-model="value"
        :placeholder="field.placeholder"
        :rules="field.rules"
        auto-grow
        :disabled="isDisabled"
        :error-messages="errorMessages"
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
        :disabled="isDisabled"
        :error-messages="errorMessages"
      />
    </template>

    <template v-else-if="field.type === InputType.Checkbox">
      <v-checkbox
        v-model="value"
        :disabled="isDisabled"
        :error-messages="errorMessages"
      />
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
          :disabled="isDisabled"
          :error-messages="errorMessages"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { InputType } from "~/types/enums/input_type";

const props = defineProps({
  field: {
    type: Object as PropType<any>,
    required: true,
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
  customErrorMessage: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const errorMessages = computed(() => {
  return props.customErrorMessage ? [props.customErrorMessage] : [];
});
</script>

<style lang="scss" scoped>
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
