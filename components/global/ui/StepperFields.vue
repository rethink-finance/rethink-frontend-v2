<template>
  <v-col v-if="title" cols="12">
    <div class="title">
      {{ title }}
    </div>
  </v-col>
  <v-col v-if="text" cols="12">
    <div class="text" v-html="text" />
  </v-col>

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
        :rules="field.rules"
      />
    </template>
    <template v-else-if="field.type === InputType.Textarea">
      <v-textarea
        v-model="valueDetails[field.key]"
        :placeholder="field.placeholder"
        :rules="field.rules"
      />
    </template>
    <template v-else-if="field.type === InputType.Select">
      <v-select
        v-model="valueDetails[field.key]"
        :rules="field.rules"
        :items="field.choices"
        item-title="title"
        item-value="value"
      />
    </template>
    <template v-else-if="field.type === InputType.Checkbox">
      <v-checkbox v-model="valueDetails[field.key]" />
    </template>
  </v-col>
</template>

<script setup lang="ts">
import { InputType } from "~/types/enums/stepper";
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

const allFieldsValid = computed(() =>
  props.fields.every((field: any) => {
    // Get field value.
    const value = valueDetails.value[field.key];

    // Check if the value is valid for all rules.
    // If there are no rules, the field is valid.
    return field?.rules?.every((rule: any) => rule(value) === true) ?? true;
  }),
);

// Check the validity of each field.
watch(
  valueDetails,
  () => {
    valueDetails.value.isValid = allFieldsValid.value;
    emit("validate", valueDetails.value);
  },
  { deep: true },
);
</script>

<style lang="scss" scoped>
.title {
  font-size: 16px;
  font-weight: 700;
  color: $color-white;
}
.text {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-irrelevant;
}
</style>
