<template>
  <div class="add-new-field">
    <v-btn
      variant="outlined"
      style="display: block; margin-block: 20px; margin-left: auto;"
      @click="isAddCustomFieldDialogOpen = true"
    >
      Add Custom Field +
    </v-btn>

    <UiConfirmDialog
      v-model="isAddCustomFieldDialogOpen"
      title="Add Custom Field"
      confirm-text="Add Field"
      cancel-text="Cancel"
      class="confirm_dialog"
      max-width="600px"
      @confirm="addCustomFieldRow(customFieldName)"
    >
      <v-label class="mb-2">
        Enter a name of custom field
      </v-label>
      <v-text-field
        v-model="customFieldName"
        placeholder="Field Name"
        outlined
        dense
        @keydown.enter="addCustomFieldRow(customFieldName)"
      />
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
    rules: [formRules.required],
    isEditable: true,
    isFieldByUser: true,
  } as IField;

  emit("addCustomField", customField);
  isAddCustomFieldDialogOpen.value = false;
  customFieldName.value = "";

};

// Watchers

// Lifecycle Hooks
</script>

<style scoped>
.add-new-field {


}
</style>
