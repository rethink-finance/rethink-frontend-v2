<template>
  <div class="method_details">
    <div
      v-for="field in fields"
      :key="field.key"
      class="method_details__field"
      :class="`method_details__field--${field.cols || getInputTypeCols(field.type)}`"
    >
      <span
        class="method_details__label"
        :class="{ 'method_details__label--required': !isFieldCheckbox(field) }"
      >
        {{ field.label }}
      </span>
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
        <v-checkbox
          v-model="methodDetails[field.key]"
          hide-details
          density="compact"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { InputType } from "~/types/enums/input_type";
import {
  getInputTypeCols,
  PositionType,
  PositionTypeValuationTypeFieldsMap,
} from "~/types/enums/position_type";
import { ValuationType } from "~/types/enums/valuation_type";
const emit = defineEmits(["update:modelValue", "validate"]);

/**
 * The fields one position/valuation type pair asks for, laid on a twelve-track
 * grid the way the create flow's forms are: a text field takes the row, a
 * number or a checkbox takes half of it.
 */
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
.method_details {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.875rem 1.25rem;

  &__field {
    grid-column: span 12;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;

    @include md {
      &--3 {
        grid-column: span 3;
      }
      &--4 {
        grid-column: span 4;
      }
      &--6 {
        grid-column: span 6;
      }
      &--12 {
        grid-column: span 12;
      }
    }
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;

    &--required::after {
      content: "*";
      margin-left: 0.25em;
      color: $color-cyan;
    }
  }
}
</style>
