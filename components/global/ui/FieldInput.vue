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
        :tabindex="tabIndex"
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
        :tabindex="tabIndex"
      />
    </template>

    <template v-else-if="field.type === InputType.Select">
      <v-select
        v-model="value"
        :rules="field.rules"
        :items="field.choices"
        item-title="title"
        item-value="value"
        density="compact"
        :disabled="isDisabled"
        :error-messages="errorMessages"
        :tabindex="tabIndex"
      />
    </template>

    <template v-else-if="field.type === InputType.Checkbox">
      <v-checkbox
        v-model="value"
        :disabled="isDisabled"
        :error-messages="errorMessages"
        :tabindex="tabIndex"
      />
    </template>

    <template v-else-if="field.type === InputType.ToggleSwitch">
      <v-switch
        v-model="value"
        :disabled="isDisabled"
        :error-messages="errorMessages"
        :tabindex="tabIndex"
        color="primary"
        hide-details
      />
    </template>

    <template v-else-if="field.type === InputType.Image">
      <div class="image_container" tabindex="-1">
        <v-avatar size="12rem" rounded="" tabindex="-1">
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
          :tabindex="tabIndex"
        />
      </div>
    </template>
    <template v-else-if="field.type === InputType.Period">
      <UiInputTimeToBlocks
        v-model="value"
        :rules="field.rules"
        :placeholder="field.placeholder"
        :is-disabled="isDisabled"
        :error-messages="errorMessages"
        :chain-id="chainId"
        :tabindex="tabIndex"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChainId } from "~/types/enums/chain_id";
import { InputType } from "~/types/enums/input_type";

const props = defineProps({
  field: {
    type: Object as PropType<any>,
    required: true,
  },
  modelValue: {
    type: [String, Number, Array, Boolean] as PropType<any>,
    default: () => undefined,
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
  chainId: {
    type: String as PropType<ChainId>,
    default: "",
  },
  tabIndex: {
    type: Number,
    default: undefined,
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
