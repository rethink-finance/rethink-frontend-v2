<template>
  <div class="target_function_params">
    <div
      v-if="func?.inputs?.length"
      class="target_function_params__inputs"
    >
      <pre
        v-if="showRaw"
        class="permissions__json"
      >{{ JSON.stringify(localCondition?.params, null, 2) }}</pre>
      <template v-else>
        <div
          v-for="(funcInputParam, index) in flattenedInputs"
          :key="index"
          class="permissions__function"
        >
          <div class="target_function_params__title">
            <Icon icon="tabler:point-filled" />
            <div>
              [{{ index }}]
              <span v-if="funcInputParam.parentName">
                {{ funcInputParam.parentName }}
              </span>
              {{ funcInputParam.name }}
            </div>
            <div class="permissions__function_params">
              ({{ funcInputParam.type }})
            </div>
          </div>
          <PermissionParamConditionInput
            :index="index"
            :param="funcInputParam"
            :condition="getParamConditionByIndex(index)"
            :disabled="disabled"
            @update:condition="(newValue) => updateParamConditionByIndex(index, newValue)"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import { type FunctionFragment } from "ethers";
import { useVModel } from "@vueuse/core";
import cloneDeep from "lodash.clonedeep";
import type { FlattenedParamType, FunctionCondition, ParamCondition } from "~/types/zodiac-roles/role";
import { flattenAbiFunctionInputs } from "~/composables/zodiac-roles/flattenAbiFunctionInputs";

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
});

// Create a local reactive copy of funcConditions to allow editing it without mutating props.
const localCondition = useVModel(props, "funcConditions", emit, {
  clone: cloneDeep, // Deep copy to avoid prop mutation
  passive: true,    // Prevents excessive reactivity updates
  deep: true,       // Ensures Vue watches nested changes
});

const flattenedInputs = computed(
  () => flattenAbiFunctionInputs(props.func?.inputs as FlattenedParamType[]),
);

const getParamConditionByIndex = (
  index: number,
): ParamCondition | undefined => {
  return localCondition.value?.params?.find((param) => param?.index === index);
}

const updateParamConditionByIndex = (index: number, newValue: ParamCondition) => {
  console.debug("updateConditionByIndex", index, toRaw(newValue), toRaw(localCondition.value));
  // localCondition.value.value[index] = newValue;
  if (!localCondition.value?.params) return;

  const condIndex = localCondition.value?.params?.findIndex((param) => param?.index === index);
  if (localCondition.value?.params && condIndex >= 0) {
    localCondition.value.params[condIndex] = newValue;
  }
}
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
