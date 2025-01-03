<template>
  <v-col
    v-for="field in fields"
    :key="field.key"
    class="method_details"
    cols="12"
    :md="field.cols || 6"
  >
    <v-label :class="{'label_required mb-2': !isFieldCheckbox(field)}">
      {{ field.label }}
    </v-label>
    <template v-if="[InputType.Text, InputType.Number].includes(field.type)">
      <v-text-field
        v-model="methodDetails[field.key]"
        :placeholder="field.placeholder"
        :type="field.type"
        :min="field.min"
        :rules="fieldRules(field)"
        required
      />
    </template>
    <template v-else-if="field.type === InputType.Textarea">
      <v-textarea
        v-model="methodDetails[field.key]"
        :placeholder="field.placeholder"
        :rules="fieldRules(field)"
        hide-details
        required
      />
    </template>
    <template v-else-if="field.type === InputType.Select">
      <v-select
        v-model="methodDetails[field.key]"
        :rules="fieldRules(field)"
        :items="field.choices"
        item-title="title"
        item-value="value"
        required
      />
    </template>
    <template v-else-if="field.type === InputType.Checkbox">
      <v-checkbox v-model="methodDetails[field.key]"  />
    </template>
  </v-col>
</template>

<script setup lang="ts">
import { InputType } from "~/types/enums/input_type";
import {
  PositionType,
  PositionTypeValuationTypeFieldsMap,
} from "~/types/enums/position_type";
import { ValuationType } from "~/types/enums/valuation_type";
const emit = defineEmits(["update:modelValue", "validate"]);

const props = defineProps({
  modelValue: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  positionType: {
    type: String as PropType<PositionType>,
    default: () => PositionType.Liquid,
  },
  valuationType: {
    type: String as PropType<ValuationType>,
    default: () => "undefined",
  },
  validateOnMount: {
    type: Boolean,
    default: false,
  },
});

const methodDetails = computed({
  get: () => props?.modelValue,
  set: (value: Record<string, any>) => {
    emit("update:modelValue", value);
  },
});

const fields = computed(() =>
  PositionTypeValuationTypeFieldsMap[props.positionType][props.valuationType] || [],
);


/**
 * Form fields validation
 **/
const rules = [
  formRules.required,
];

const fieldRules = (field: any) => {
  // Concat default rules with field specific rules if it has it.
  return rules.concat(field.rules || []);
}
// For now, we make all fields required. If we wanted to change the required field based for
// each field differently, we have to set the "required" property in the field definition.
const isFieldCheckbox = (field: any) => {
  return field.type === InputType.Checkbox
}
const allFieldsValid = computed(() =>
  fields.value.every((field: any) => {
    // Checkboxes are not required. All other fields are required for now.
    if (isFieldCheckbox(field)) return true;

    // Get field value.
    const value = methodDetails.value[field.key];

    // Check if the value is valid for all rules.
    return fieldRules(field).every((rule: any) => rule(value) === true);
  }),
);

// Check the validity of each field.
watch(
  methodDetails, () => {
    methodDetails.value.isValid = allFieldsValid.value;
  },
  { deep: true },
);

onMounted(() => {
  if (props.validateOnMount) {
    methodDetails.value.isValid = allFieldsValid.value;
  }
});

</script>

<style lang="scss" scoped>
.buttons_container {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 0.5rem;
}
.request_deposit {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-size: $text-sm;
  line-height: 1;

  &__token {
    font-weight: 500;
    width: 100%;
  }
  &__token_header {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: $color-light-subtitle
  }
  &__token_data {
    @include borderGray;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0.5rem;
    color: $color-white;
  }
  &__token_col {
    padding: 0.75rem;
    height: 2.5rem;
    background: $color-navy-gray;

    &:first-of-type {
      @include borderGray("border-right", false);
    }
    &--dark {
      background: $color-navy-gray-dark;
    }
  }
  &__balance {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
