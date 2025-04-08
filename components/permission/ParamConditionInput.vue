<template>
  <div class="param_condition_input permissions__function">
    <div class="param_condition_input__title">
      <Icon icon="tabler:point-filled" />
      <div>
        [{{ index }}]
        <span v-if="param?.parentName">
          {{ param.parentName }}
        </span>
        <template v-if="param?.name">
          {{ param.name }}
        </template>
      </div>
      <div class="permissions__function_params">
        ({{ param?.type || condition?.type || "Unknown type" }})
      </div>
      <div class="permissions__json break-words ">
        {{ localCondition }}
      </div>

    </div>

    <UiButtonAddRow
      v-if="!condition?.type && !disabled"
      class="ms-3 mt-2"
      @click="addNewCondition"
    >
      Add Condition
    </UiButtonAddRow>
    <template
      v-else-if="nativeType === ParamNativeType.BOOLEAN"
    >
      <v-select
        v-model="localCondition.value[0]"
        :items="booleanOptions"
        :disabled="disabled"
        class="select_condition_type"
        label="Boolean Condition"
        density="compact"
        variant="outlined"
        hide-details
      />
    </template>
    <template v-else-if="condition?.type">
      <v-select
        v-model="localCondition.condition"
        :items="conditionOptions"
        :disabled="disabled"
        :readonly="disabled"
        label="Condition"
        class="select_condition_type"
        density="compact"
        variant="outlined"
        hide-details
        :menu-icon="disabled ? '' : '$dropdown'"
      />
      <!-- "One of" field, needs to iterate over more ParamConditionInputValue -->
      <div
        v-if="localCondition.condition === ParamComparison.ONE_OF"
        class="d-flex flex-column flex-grow-1"
      >
        <div class="d-flex flex-column flex-grow-1">
          <div
            v-for="(conditionValue, valueIndex) in localCondition.value"
            :key="valueIndex"
            class="d-flex"
          >
            <PermissionParamConditionInputValue
              :model-value="conditionValue"
              :param="param"
              :condition-type="localCondition.condition"
              :disabled="disabled"
              @update:model-value="(newValue) => updateConditionValueByIndex(valueIndex, newValue)"
            />
            <UiButtonDelete
              v-if="!disabled"
              small
              @click="deleteCondition(valueIndex)"
            />
          </div>
        </div>
        <div
          v-if="!disabled"
          class="btn_add_param mx-auto mt-2"
          @click="addNewOneOfValue"
        >
          Add Value +
        </div>
      </div>
      <div v-else class="d-flex flex-grow-1">
        <PermissionParamConditionInputValue
          :model-value="localCondition.value[0]"
          :param="param"
          :condition-type="localCondition.condition"
          :disabled="disabled"
          @update:model-value="(newValue) => updateConditionValueByIndex(0, newValue)"
        />
        <UiButtonDelete
          v-if="!disabled"
          small
          @click="deleteCondition"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FlattenedParamType, ParamCondition } from "~/types/zodiac-roles/role";
import {
  getConditionType,
  getNativeType,
  getConditionsPerType,
  BooleanValue,
  ConditionLabel,
} from "~/composables/zodiac-roles/conditions";
import { ParamComparison, ParamNativeType } from "~/types/enums/zodiac-roles";
const emit = defineEmits(["update:condition"]);

const props = defineProps({
  index: {
    type: Number,
    required: true,
  },
  param: {
    type: Object as PropType<FlattenedParamType>,
    default: undefined,
  },
  condition: {
    type: Object as PropType<ParamCondition>,
    default: () => {},
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
const localCondition = ref<ParamCondition>({
  ...props.condition,
  value: [...(props.condition?.value || [])],
});
const nativeType = computed(() => getNativeType(props?.param));
const type = computed(() => getConditionType(nativeType.value));

// Options for the select dropdown
const booleanOptions = [
  { title: "is false", value: BooleanValue.FALSE },
  { title: "is true", value: BooleanValue.TRUE },
];

const conditionsPerType = computed<ParamComparison[]>(() => getConditionsPerType(nativeType.value));
const conditionOptions = computed(() =>
  conditionsPerType.value?.map((option) => ({
    title: ConditionLabel[option],
    value: option,
  })) || [],
);

const addNewOneOfValue = () => {
  localCondition.value.value.push("")
}
const addNewCondition = () => {
  if (nativeType.value === ParamNativeType.BOOLEAN) {
    Object.assign(localCondition.value, {
      index: props.index,
      type: type.value,
      condition: ParamComparison.EQUAL_TO,
      value: [BooleanValue.FALSE],
    });
  }
  // Assign reactively, to not lose reactivity.
  Object.assign(localCondition.value, {
    index: props.index,
    type: type.value,
    condition: conditionsPerType.value[0],
    value: [""],
  });
}
const deleteCondition = (oneOfValueIndex?: number) => {
  // If the condition is "OneOf" type and there are more values in the array,
  // we want to remove only the one that was passed as oneOfValueIndex.
  // If it's the last one, remove the condition entirely.
  if (localCondition.value.value.length > 1 && oneOfValueIndex !== undefined) {
    localCondition.value.value = localCondition.value.value.filter((_, i) => i !== oneOfValueIndex);
    // Stop execution after deletion to prevent unnecessary resets.
    return;
  }
  // Assign reactively, to not lose reactivity.
  // Reset values, do not remove it from array to not lose reactivity.
  Object.assign(localCondition.value, {
    index: props.index,
    type: "",
    condition: "",
    value: [""],
  });
}
const updateConditionValueByIndex = (index: number, newValue: string) => {
  localCondition.value.value[index] = newValue;
}

// Watch for changes in localCondition and emit updates
const previousCondition = ref<ParamComparison>({ ...localCondition.value?.condition });

watch(
  () => localCondition.value,
  (newLocalFuncConditions, oldLocalFuncConditions) => {
    // If previous condition was "One Of" and the new one is not, we will
    // take only the first value from it.
    if (previousCondition.value === ParamComparison.ONE_OF && previousCondition.value !== newLocalFuncConditions.condition) {
      if (newLocalFuncConditions?.type === ParamNativeType.BOOLEAN) {
        // If new condition is boolean, just set default false value.
        newLocalFuncConditions.value = [BooleanValue.FALSE];
      } else {
        // Take the first element of value array if condition is not boolean.
        newLocalFuncConditions.value = [newLocalFuncConditions.value[0] || ""];
      }
    }

    if (JSON.stringify(newLocalFuncConditions) !== JSON.stringify(props.condition)) {
      emit("update:condition", newLocalFuncConditions);
    }
    // Store the new value as previous, to track changes.
    previousCondition.value = newLocalFuncConditions.condition;
  },
  { deep: true },
);

// Update localCondition when `props.condition` changes (but don't emit).
watch(
  () => props.condition,
  (newCondition) => {
    // Update without emitting
    if (JSON.stringify(newCondition) !== JSON.stringify(localCondition.value)) {
      // TODO check boolean when editing if they update correctly, convert bool to string
      localCondition.value = { ...newCondition };
    }
  },
  { deep: true, immediate: true },
);

// TODO check boolean when editing if they update correctly
// const handleBooleanChange = (value: string) =>
//   onChange({ index, type, condition: ParamComparison.EQUAL_TO, value: [value] })
// const handleBooleanChange = (newValue: string) => {
//   props.condition.value[0] = newValue; // Update the condition value
// };
</script>

<style lang="scss" scoped>
.param_condition_input {
  &__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 2.75rem;
    white-space: nowrap;
  }
}

.select_condition_type {
  display: flex;
  flex-grow: 0;
  height: fit-content;
  min-width: max-content;
}
</style>
