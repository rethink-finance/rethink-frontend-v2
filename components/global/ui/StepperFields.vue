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
    <v-label class="row-title">
      <div
        :class="field.required ?? true ? 'label_required' : ''"
        class="row-title__title"
      >
        {{ field.label }}
        <v-label class="label_required__label_type">
          {{ field.internalType }}
          <template v-if="field.internalType !== field.input?.type">
            ({{ field.input?.type }})
          </template>
        </v-label>
      </div>
      <ui-char-limit
        v-if="field.charLimit"
        :char-limit="field.charLimit"
        :char-number="valueDetails[field.key]"
      />
    </v-label>

    <template v-if="[InputType.Text, InputType.Number].includes(field.type)">
      <v-text-field
        v-if="!field.isArray"
        v-model="valueDetails[field.key]"
        :placeholder="field.placeholder"
        :type="field.type"
        :min="field.min"
        :rules="field.rules"
      />
      <div
        v-for="(value, index) in valueDetails[field.key]"
        v-else
        class="is-array"
      >
        <div class="is-array__count-index">
          {{ index }}
        </div>
        <v-text-field
          :key="index"
          v-model="valueDetails[field.key][index]"
          :placeholder="field.placeholder"
          :type="field.type"
          :min="field.min"
          :rules="field.rules"
          class="is-array__input"
        >
          <Icon
            icon="material-symbols:cancel-outline"
            class="is-array__remove"
            @click="removeField(field, index)"
          /></v-text-field>
      </div>
    </template>
    <template v-else-if="field.type === InputType.ReadonlyJSON">
      <div class="json_field">
        {{ valueDetails[field.key] }}
      </div>
    </template>
    <template v-else-if="field.type === InputType.Textarea">
      <v-textarea
        v-if="!field.isArray"
        v-model="valueDetails[field.key]"
        :placeholder="field.placeholder"
        :rules="field.rules"
      />
      <div
        v-for="(value, index) in valueDetails[field.key]"
        v-else
        class="is-array"
      >
        <div class="is-array__count-index">
          {{ index }}
        </div>
        <v-textarea
          :key="index"
          v-model="valueDetails[field.key][index]"
          :placeholder="field.placeholder"
          :rules="field.rules"
        />
        <Icon
          icon="material-symbols:cancel-outline"
          class="is-array__remove"
          @click="removeField(field, index)"
        />
      </div>
    </template>
    <template v-else-if="field.type === InputType.Select">
      <v-select
        v-if="!field.isArray"
        v-model="valueDetails[field.key]"
        :rules="field.rules"
        :items="field.choices"
        item-title="title"
        item-value="value"
        density="compact"
      />
      <div
        v-for="(value, index) in valueDetails[field.key]"
        v-else
        class="is-array select"
      >
        <div class="is-array__count-index">
          {{ index }}
        </div>
        <v-select
          :key="index"
          v-model="valueDetails[field.key][index]"
          :rules="field.rules"
          :items="field.choices"
          item-title="title"
          item-value="value"
          density="compact"
        />
        <Icon
          icon="material-symbols:cancel-outline"
          class="is-array__remove"
          @click="removeField(field, index)"
        />
      </div>
    </template>
    <template v-else-if="field.type === InputType.Checkbox">
      <v-checkbox v-if="!field.isArray" v-model="valueDetails[field.key]" />

      <div
        v-for="(value, index) in valueDetails[field.key]"
        v-else
        class="is-array"
      >
        <div class="is-array__count-index">
          {{ index }}
        </div>
        <v-checkbox :key="index" v-model="valueDetails[field.key][index]" />
        <Icon
          icon="material-symbols:cancel-outline"
          class="is-array__remove"
          @click="removeField(field, index)"
        />
      </div>
    </template>
    <!-- check if field "isArray", if yes allow adding new fields -->
    <template v-if="field.isArray">
      <div class="btn_add_param" @click="addNewField(field)">
        Add Parameters +
      </div>
    </template>
  </v-col>
</template>

<script setup lang="ts">
import { defaultInputTypeValue, InputType } from "~/types/enums/input_type";
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

// Reusable validation logic
const validateFields = () => {
  // Check if the value is valid for all rules.
  // If there are no rules, the field is valid.
  return props.fields.every((field: any) => {
    const value = valueDetails.value[field.key];
    return (
      field?.rules?.every((rule: any) => {
        // we need to check if a value is an array
        // if it is, we need to check each value in the array
        if (Array.isArray(value)) {
          return value.every((val) => rule(val) === true);
        }

        return rule(value) === true;
      }) ?? true
    );
  });
};

// Initialize validation on mount
onMounted(() => {
  valueDetails.value.isValid = validateFields();
});

// Watch for changes in fields and modelValue
watch(
  [() => props.fields, () => props.modelValue],
  () => {
    valueDetails.value.isValid = validateFields();
    emit("validate", valueDetails.value);
  },
  { deep: true, immediate: true },
);

// Methods for adding/removing array fields
const addNewField = (field: any) => {
  const type = field.type as InputType;
  const defaultValue =
    field?.defaultValue !== undefined
      ? field.defaultValue
      : defaultInputTypeValue[type];

  valueDetails.value[field.key].push(defaultValue);
};

const removeField = (field: any, index: number) => {
  if (valueDetails.value[field.key].length > 1) {
    valueDetails.value[field.key].splice(index, 1);
  }
};
</script>

<style lang="scss" scoped>
.title {
  font-size: $text-md;
  font-weight: 700;
  color: $color-white;
}
.text {
  font-size: $text-sm;
  font-weight: 500;
  color: $color-text-irrelevant;
}

.row-title {
  display: flex;
  justify-content: space-between;
}

.label_required {
  margin-bottom: 5px;

  &__label_type {
    margin-left: 5px;
  }
}

.is-array {
  display: flex;
  align-content: center;
  gap: 10px;

  &:last-child {
    margin-bottom: 0;
  }

  // position the remove icon to the top right of the select field
  &.select {
    position: relative;

    :deep(.v-field) {
      padding-right: 40px;
    }
    .is-array__remove {
      position: absolute;
      top: 10px;
      right: 10px;
    }
  }

  &__count-index {
    display: flex;
    justify-content: center;
    align-items: center;

    width: 42px;
    height: 42px;
    background-color: $color-background-button;
    @include borderGray;
  }

  &__input {
    :deep(.v-field__input) {
      flex-direction: row-reverse;
      padding: 0 10px 0 0;
      min-height: 2.5rem;
    }
  }

  &__remove {
    cursor: pointer;

    width: 25px;
    height: 25px;
    color: $color-background-button;

    transition: color 0.2s ease;

    &:hover {
      color: $color-error;
    }
  }
}

//.btn_add_param {
//  width: max-content;
//  margin-left: auto;
//  padding: 0.5rem;
//
//  font-size: $text-sm;
//  color: $color-text-irrelevant;
//  cursor: pointer;
//  user-select: none;
//  text-align: center;
//
//  transition: background-color 0.3s ease;
//
//  &:hover {
//    background-color: $color-gray-light-transparent;
//  }
//}

</style>
