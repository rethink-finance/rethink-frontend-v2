<template>
  <UiDataRowCard
    no-body-padding
    bg-transparent
    class="target_function"
    :is-expandable="!!funcConditions?.type"
  >
    <template #title>
      <div class="permissions__function">
        <div class="mt-1">
          <v-checkbox-btn
            :model-value="funcConditions?.type === ConditionType.WILDCARDED"
            :indeterminate="funcConditions?.type === ConditionType.SCOPED"
            disabled
          />
        </div>
        <div>
          {{ func?.name || sighash }}
        </div>
        <div class="permissions__function_params">
          {{ functionParamsText }}
        </div>
      </div>
    </template>
    <template #body>
      <span v-if="funcConditions?.sighash" class="target_function__condition">
        <div class="d-flex align-center">
          <pre class="permissions__json me-6"><strong>sighash:</strong> {{ funcConditions?.sighash }}</pre>
          <PermissionExecutionOptions
            v-model="localFuncConditions.executionOption"
            disabled
          />
        </div>
        <PermissionTargetFunctionParams
          class="ms-4"
          :func="func"
          :sighash="sighash"
          :func-conditions="funcConditions"
        />
        <!-- TODO remove this RAW json -->
        <!--        <pre class="permissions__json">{{ JSON.stringify(funcConditions, null, 4) }}</pre>-->
      </span>
    </template>
  </UiDataRowCard>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import type { FunctionCondition } from "~/types/zodiac-roles/role";
import { getParamsTypesTitle } from "~/composables/zodiac-roles/target";
import { ConditionType } from "~/types/enums/zodiac-roles";

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
});
// Create a local reactive copy of funcConditions to allow editing it without mutating props.
const localFuncConditions = ref<FunctionCondition>({ ...props.funcConditions });

// Watch for changes in localFuncConditions and emit updates
watch(
  localFuncConditions,
  (newLocalFuncConditions) => {
    if (JSON.stringify(newLocalFuncConditions) !== JSON.stringify(props.funcConditions)) {
      console.log("    [2] watch localFuncConditions", toRaw(newLocalFuncConditions))
      emit("update:funcConditions", newLocalFuncConditions);
    }
  },
  { deep: true },
);

// Update `localFuncConditions` when `props.funcConditions` changes (but don't emit).
watch(
  () => props.funcConditions,
  (newFuncConditions) => {
    // Update without emitting
    if (JSON.stringify(newFuncConditions) !== JSON.stringify(localFuncConditions.value)) {
      console.log("    [2] watch props.funcConditions", toRaw(newFuncConditions))
      localFuncConditions.value = { ...newFuncConditions };
    }
  },
  { deep: true, immediate: true },
);

const functionParamsText = computed(() =>
  props.func ? getParamsTypesTitle(props.func) : "(function not found in ABI)",
)
</script>

<style lang="scss" scoped>
.target_function {
  &__condition {
    display: flex;
    flex-direction: column;
    padding: 1rem;
  }
}
</style>
