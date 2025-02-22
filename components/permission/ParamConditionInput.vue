<template>
  <template
    v-if="nativeType === ParamNativeType.BOOLEAN"
  >
    <v-select
      v-model="localCondition.value[0]"
      :items="booleanOptions"
      :disabled="disabled"
      label="Boolean Condition"
      density="compact"
      variant="outlined"
      hide-details
    />
  </template>
  <template v-else-if="condition">
    <v-select
      v-model="localCondition.condition"
      :items="conditionOptions"
      :disabled="disabled"
      :readonly="disabled"
      label="Condition"
      class="flex-grow-0"
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
      <PermissionParamConditionInputValue
        v-for="(conditionValue, valueIndex) in localCondition.value"
        :key="valueIndex"
        :model-value="conditionValue"
        :param="param"
        :condition-type="localCondition.condition"
        :disabled="disabled"
        @update:model-value="(newValue) => updateConditionValueByIndex(valueIndex, newValue)"
      />
    </div>
    <template v-else>
      <PermissionParamConditionInputValue
        :model-value="localCondition.value[0]"
        :param="param"
        :condition-type="localCondition.condition"
        :disabled="disabled"
        @update:model-value="(newValue) => updateConditionValueByIndex(0, newValue)"
      />
    </template>
  </template>
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

const conditionOptions = computed(() =>
  getConditionsPerType(nativeType.value)?.map((option) => ({
    title: ConditionLabel[option],
    value: option,
  })) || [],
);

const updateConditionValueByIndex = (index: number, newValue: string) => {
  console.log("updateConditionValueByIndex", index, newValue, toRaw(localCondition.value));
  localCondition.value.value[index] = newValue;
}

// Watch for changes in localCondition and emit updates
watch(
  localCondition,
  (newLocalFuncConditions) => {
    if (JSON.stringify(newLocalFuncConditions) !== JSON.stringify(props.condition)) {
      console.log("    [2] watch localCondition", toRaw(newLocalFuncConditions))
      emit("update:condition", newLocalFuncConditions);
    }
  },
  { deep: true },
);

// Update localCondition when `props.condition` changes (but don't emit).
watch(
  () => props.condition,
  (newCondition) => {
    // Update without emitting
    if (JSON.stringify(newCondition) !== JSON.stringify(localCondition.value)) {
      console.log("    [2] watch props.condition", toRaw(newCondition))
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

</style>
