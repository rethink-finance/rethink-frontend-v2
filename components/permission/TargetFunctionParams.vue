<template>
  <div class="target_function_params">
    <div class="target_function_params__inputs">
      <pre v-if="showRaw" class="json_field">{{
        JSON.stringify(localFuncCondition?.params, null, 2)
      }}</pre>
      <template v-else-if="flattenedInputs.length">
        <template
          v-for="(funcInputParam, index) in flattenedInputs"
        >
          <PermissionParamConditionInput
            v-if="!onlyShowConditionParams || getParamConditionByIndex(index).type"
            class="permissions__function"
            :index="index"
            :param="funcInputParam"
            :condition="getParamConditionByIndex(index)"
            :disabled="disabled"
            @update:condition="
              (newValue) => updateParamConditionByIndex(index, newValue)
            "
          />
        </template>
      </template>
      <template v-else>
        <!--
          Contract ABI not found, but we still want to render conditions
          at least as view only.
        -->
        <PermissionParamConditionInput
          v-for="index in indices"
          :key="index"
          class="permissions__function"
          :index="index"
          :param="undefined"
          :condition="getParamConditionByIndex(index)"
          :disabled="disabled"
          @update:condition="
            (newValue) => updateParamConditionByIndex(index, newValue)
          "
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import { type FunctionFragment } from "ethers";
import { useVModel } from "@vueuse/core";
import cloneDeep from "lodash.clonedeep";
import type {
  FlattenedParamType,
  FunctionCondition,
  ParamCondition,
} from "~/types/zodiac-roles/role";
import { flattenAbiFunctionInputs } from "~/composables/zodiac-roles/flattenAbiFunctionInputs";
import { ConditionType } from "~/types/enums/zodiac-roles";

const emit = defineEmits(["update:funcConditions"]);

const props = defineProps({
  func: {
    type: Object as PropType<FunctionFragment>,
    default: undefined,
  },
  funcConditions: {
    type: Object as PropType<FunctionCondition>,
    default: undefined,
  },
  sighash: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  showRaw: {
    type: Boolean,
    default: false,
  },
  onlyShowConditionParams: {
    type: Boolean,
    default: false,
  },
});

// Create a local reactive copy of funcConditions to allow editing it without mutating props.
const localFuncCondition = useVModel(props, "funcConditions", emit, {
  clone: cloneDeep, // Deep copy to avoid prop mutation
  passive: true, // Prevents excessive reactivity updates
  deep: true, // Ensures Vue watches nested changes
});

const flattenedInputs = computed(() =>
  flattenAbiFunctionInputs(props.func?.inputs as FlattenedParamType[]),
);

const maxIndex = computed(
  () =>
    localFuncCondition.value?.params?.reduce(
      (max, param) => Math.max(max, param.index),
      -1,
    ) ?? 0,
);
const indices = computed(() =>
  Array.from({ length: maxIndex.value + 1 }, (_, i) => i),
);

const getParamConditionByIndex = (index: number): ParamCondition => {
  // Try find param by the provided index or return reactive default param if it does not exist.
  return (
    localFuncCondition.value?.params?.find(
      (param) => param?.index?.toString() === index.toString(),
    ) ?? { index, type: "", condition: "", value: [""] }
  );
};

const updateParamConditionByIndex = (
  index: number,
  newValue: ParamCondition,
) => {
  console.debug(
    "updateConditionByIndex",
    index,
    toRaw(newValue),
    toRaw(localFuncCondition.value),
  );
  if (!localFuncCondition.value?.params) return;

  // Create a new array excluding the current condition, we will determine
  // if we want to include the current condition or not in the next step.
  const newParams = localFuncCondition.value.params.filter(
    (param) => param.index !== index,
  );

  // If newValue is valid, add it to the params array
  // If there is no type, it means it was set to an empty string, which means
  // we should not include it, basically we are removing it.
  if (newValue?.type) {
    newParams.push(newValue);
  }

  // Determine condition type (SCOPED if any conditions exist, otherwise WILDCARDED)
  const type = newParams.length
    ? ConditionType.SCOPED
    : ConditionType.WILDCARDED;

  // Assign new array and object reference to maintain reactivity
  localFuncCondition.value = {
    ...localFuncCondition.value,
    type,
    params: newParams,
  };
};
</script>

<style lang="scss" scoped>
.target_function_params {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow: hidden;

  &__inputs {
    overflow: auto;
    @include customScrollbar(0);
  }
  &__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 2.75rem;
  }
}
.permissions__function {
  align-items: flex-start;
}
</style>
