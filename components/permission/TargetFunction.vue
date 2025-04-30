<template>
  <!-- Do not display this component if the user is in read-only mode and
  if there are no condition params set. -->
  <UiDataRowCard
    v-if="!disabled || (disabled && funcConditions?.params?.length > 0)"
    :is-expanded="(disabled && funcConditions?.params?.length > 0)"
    no-body-padding
    bg-transparent
    title-full-height
    class="target_function"
  >
    <template #title>
      <div class="permissions__function">
        <div class="mt-1">
          <v-checkbox-btn
            :model-value="
              [ConditionType.WILDCARDED, ConditionType.SCOPED].includes(localFuncConditions?.type)
            "
            :indeterminate="isIndeterminate"
            :disabled="disabled"
            @click.stop
            @update:model-value="handleFunctionCheck"
          />
        </div>
        <p>
          <span>
            {{ func?.name || sighash }}
          </span>
          <span class="permissions__function_params">
            {{ functionParamsText }}
          </span>
        </p>
      </div>
    </template>
    <template #body>
      <span class="target_function__condition">
        <div
          v-if="localFuncConditions.executionOption !== undefined"
          class="d-flex align-center"
        >
          <pre
            class="json_field me-4"
          ><strong>sighash:</strong> {{ funcConditions?.sighash }}</pre>
          <PermissionExecutionOptions
            :model-value="localFuncConditions.executionOption"
            :disabled="disabled"
            :only-show-condition-params="onlyShowConditionParams"
            @update:model-value="updateExecutionOption"
          />
        </div>

        <PermissionTargetFunctionParams
          v-model:func-conditions="localFuncConditions"
          :func="func"
          :sighash="sighash"
          :disabled="disabled"
          :only-show-condition-params="onlyShowConditionParams"
        />
      </span>
    </template>
  </UiDataRowCard>
</template>

<script setup lang="ts">
import { FunctionFragment } from "ethers";
import { useVModel } from "@vueuse/core";
import cloneDeep from "lodash.clonedeep";
import type { FunctionCondition } from "~/types/zodiac-roles/role";
import { getParamsTypesTitle } from "~/composables/zodiac-roles/target";
import { ConditionType, ExecutionOption } from "~/types/enums/zodiac-roles";

/**
 * This component displays function conditions based on ABI detection.
 *
 * - If a function fragment (`func`) is provided, it means the function was found in the ABI.
 * - If `func` is missing but a `sighash` is provided, it means the function was NOT found in the ABI.
 *
 * @prop {FunctionFragment | undefined} func - The function fragment from the contract ABI, if available.
 * @prop {string} sighash - The function signature hash (sighash) used as an identifier if the ABI is missing.
 * @prop {FunctionCondition} funcConditions - The associated conditions for the function or sighash.
 */
const emit = defineEmits(["update:funcConditions"]);

const props = defineProps({
  func: {
    type: Object as PropType<FunctionFragment>,
    default: undefined,
  },
  sighash: {
    type: String,
    default: "",
  },
  funcConditions: {
    type: Object as PropType<FunctionCondition>,
    default: () => {},
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  onlyShowConditionParams: {
    type: Boolean,
    default: false,
  },
});

// Create a local reactive copy of funcConditions to allow editing it without mutating props.
const localFuncConditions = useVModel(props, "funcConditions", emit, {
  clone: cloneDeep, // Deep copy to avoid prop mutation
  passive: true,    // Prevents excessive reactivity updates
  deep: true,       // Ensures Vue watches nested changes
});

const isIndeterminate = computed(() => localFuncConditions?.value?.type === ConditionType.SCOPED);

const functionParamsText = computed(() =>
  props.func ? getParamsTypesTitle(props.func) : "(function not found in ABI)",
)

const updateExecutionOption = (option: ExecutionOption) => {
  let type = localFuncConditions?.value?.type;
  // When the function was not yet selected and user clicks on "Allow Sending Ether"
  // then the function should be marked as selected.
  if (type === ConditionType.BLOCKED && option !== ExecutionOption.NONE) {
    type = ConditionType.WILDCARDED
  }
  localFuncConditions.value = {
    ...localFuncConditions.value,
    executionOption: option,
    type,
  };
}
const handleFunctionCheck = (checked: boolean) => {
  const type =
    checked && localFuncConditions?.value?.type !== ConditionType.SCOPED
      ? ConditionType.WILDCARDED
      : ConditionType.BLOCKED;

  // Reset params and assign new type.
  localFuncConditions.value = {
    ...localFuncConditions.value,
    params: [],
    sighash: props.func?.selector || props.sighash,
    type,
  };
};
</script>

<style lang="scss" scoped>
.target_function {
  &__condition {
    display: flex;
    flex-direction: column;
    padding: 0.25rem 1rem 1rem 1rem;
    overflow-y: hidden;
    height: 100%;
  }
}
</style>
