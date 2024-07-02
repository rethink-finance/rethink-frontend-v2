<template>
  <v-row>
    <v-col>
      <strong>{{ title }}</strong>
    </v-col>
  </v-row>
  <v-row>
    <v-col>
      <strong>{{ text }}</strong>
    </v-col>
  </v-row>

  <v-col
    v-for="field in fields"
    :key="field.key"
    class="method_details"
    cols="12"
  >
    <v-label class="label_required">
      {{ field.label }}
    </v-label>
    <template v-if="[InputType.Text, InputType.Number].includes(field.type)">
      <v-text-field
        v-model="valueDetails[field.key]"
        :placeholder="field.placeholder"
        :type="field.type"
        :min="field.min"
        :rules="fieldRules(field)"
        required
      />
    </template>
    <template v-else-if="field.type === InputType.Textarea">
      <v-textarea
        v-model="valueDetails[field.key]"
        :placeholder="field.placeholder"
        :rules="fieldRules(field)"
        hide-details
        required
      />
    </template>
  </v-col>
</template>

<script setup lang="ts">
import { InputType } from "~/types/enums/direct_execution";
const emit = defineEmits(["update:modelValue", "validate"]);

const props = defineProps({
  title: {
    type: String,
    default: "",
  },
  text: {
    type: String,
    default: "",
  },
  modelValue: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  fields: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
});

const valueDetails = computed({
  get: () => props?.modelValue,
  set: (value: Record<string, any>) => {
    emit("update:modelValue", value);
  },
});

console.log("FIELDSSDSDSDSDSDSD", props.fields);

/**
 * Form fields validation
 **/
const rules = [formRules.required];

const fieldRules = (field: any) => {
  // Concat default rules with field specific rules if it has it.
  return rules.concat(field.rules || []);
};

const allFieldsValid = computed(() =>
  props.fields.every((field: any) => {
    // Get field value.
    const value = valueDetails.value[field.key];

    // Check if the value is valid for all rules.
    return fieldRules(field).every((rule: any) => rule(value) === true);
  })
);

// Check the validity of each field.
watch(
  valueDetails,
  () => {
    valueDetails.value.isValid = allFieldsValid.value;
  },
  { deep: true }
);
</script>

<style lang="scss" scoped></style>
