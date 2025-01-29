<template>
  <UiDataRowCard
    no-body-padding
    bg-transparent
    class="target_function"
    :is-expandable="!!condition?.type"
  >
    <template #title>
      <div class="target_function__sighash">
        <div class="mt-1">
          <v-checkbox-btn
            :model-value="condition?.type === ConditionType.WILDCARDED"
            :indeterminate="condition?.type === ConditionType.SCOPED"
            disabled
          />
        </div>
        <div>
          {{ func?.name || sighash }}
        </div>
        <div class="target_function__params">
          {{ functionParamsText }}
        </div>
      </div>
    </template>
    <template #body>
      <span v-if="condition?.sighash" class="target_function__condition">
        <pre class="permissions__json"><strong>sighash:</strong> {{ condition?.sighash }}</pre>
        <PermissionExecutionOptions v-model="localCondition.executionOption" />
        <pre class="permissions__json">{{ JSON.stringify(condition, null, 4) }}</pre>
      </span>
    </template>
  </UiDataRowCard>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import { defineEmits } from "vue";
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
 * @prop {FunctionCondition} condition - The associated condition for the function or sighash.
 */
const emit = defineEmits(["update:condition"]);

const props = defineProps({
  func: {
    type: Object as PropType<FunctionFragment>,
    default: undefined,
  },
  sighash: {
    type: String,
    default: "",
  },
  condition: {
    type: Object as PropType<FunctionCondition>,
    default: () => {},
  },
});
// Create a local reactive copy of condition to allow editing it without mutating props.
const localCondition = ref<FunctionCondition>({ ...props.condition });

// Watch for prop changes and update localCondition**
// Watch for changes in `localCondition` and emit updates
watch(
  localCondition,
  (newValue) => {
    if (JSON.stringify(newValue) !== JSON.stringify(props.condition)) {
      console.log("    [2] watch localCondition", toRaw(newValue))
      emit("update:condition", newValue);
    }
  },
  { deep: true },
);

// Update `localCondition` when `props.condition` changes (but don't emit).
watch(
  () => props.condition,
  (newCondition) => {
    // Update without emitting
    if (JSON.stringify(newCondition) !== JSON.stringify(localCondition.value)) {
      console.log("    [2] watch props.condition", toRaw(newCondition))
      localCondition.value = { ...newCondition };
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
  &__sighash {
    display: flex;
    flex-direction: row;
    align-content: center;
    align-items: center;
    font-family: monospace;
    white-space: pre-wrap;
  }
  &__params {
    color: $color-steel-blue;
    margin-left: 0.3rem;
  }
  &__condition {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }
}
</style>
