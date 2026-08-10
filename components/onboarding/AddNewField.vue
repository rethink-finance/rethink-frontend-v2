<template>
  <div class="add_new_field">
    <button
      type="button"
      class="add_new_field__button"
      @click="isAddCustomFieldDialogOpen = true"
    >
      Add custom field +
    </button>

    <UiConfirmDialog
      v-model="isAddCustomFieldDialogOpen"
      title="Add custom field"
      confirm-text="Add field"
      cancel-text="Cancel"
      class="confirm_dialog"
      max-width="520px"
      @confirm="addCustomFieldRow(customFieldName)"
      @cancel="isAddCustomFieldDialogOpen = false"
    >
      <label class="add_new_field__label" for="custom-field-name">
        Field name
      </label>
      <input
        id="custom-field-name"
        v-model="customFieldName"
        class="add_new_field__input"
        type="text"
        placeholder="E.g. Benchmark"
        @keydown.enter="addCustomFieldRow(customFieldName)"
      >
    </UiConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "~/store/toasts/toast.store";
import { InputType, type IField } from "~/types/enums/input_type";


const toastStore = useToastStore();
const emit = defineEmits(["addCustomField"]);


// Data
const isAddCustomFieldDialogOpen = ref(false);
const customFieldName = ref("");

// Computeds

// Methods
const addCustomFieldRow = (fieldName: string) => {
  if (!fieldName) {
    return toastStore.errorToast("Please enter a field name");
  }

  const customField = {
    label: fieldName,
    key: toCamelCase(fieldName),
    type: InputType.Text,
    value: "",
    placeholder: "",
    rules: [formRules.required],
    isEditable: true,
    isFieldByUser: true,
    cols: 6,
  } as IField;

  emit("addCustomField", customField);
  isAddCustomFieldDialogOpen.value = false;
  customFieldName.value = "";

};

// Watchers

// Lifecycle Hooks
</script>

<style scoped lang="scss">
.add_new_field {
  &__button {
    padding: 9px 14px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: transparent;
    font-family: $font-mono;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-white;
    cursor: pointer;
    transition: border-color $default-transition-time ease;

    &:hover {
      border-color: $color-line-3;
    }
  }

  &__label {
    display: block;
    margin-bottom: 0.375rem;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__input {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid $color-line-2;
    border-radius: $default-border-radius;
    background: $color-card-background;
    font-family: $font-mono;
    font-size: 12.5px;
    color: $color-white;

    &::placeholder {
      color: $color-steel-blue;
    }
    &:focus {
      outline: none;
      border-color: $color-accent-line;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__button {
      transition: none;
    }
  }
}
</style>
