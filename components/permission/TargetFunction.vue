<template>
  <UiDataRowCard
    no-body-padding
    bg-transparent
    class="permission_target_function"
    :is-expandable="!!condition"
  >
    <template #title>
      <div class="permission_target_function__sighash">
        <div class="mt-1">
          <v-checkbox-btn
            :model-value="!!condition"
            disabled
          />
        </div>
        <div>
          {{ func?.name || sighash }}
        </div>
        <div class="permission_target_function__params">
          {{ functionParamsText }}
        </div>
      </div>
    </template>
    <template #body>
      <span class="permission_target_function__content">
        <pre class="permissions__json">{{ JSON.stringify(condition, null, 4) }}</pre>
      </span>
    </template>
  </UiDataRowCard>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import type { FunctionCondition } from "~/types/zodiac-roles/role";
import { getParamsTypesTitle } from "~/composables/zodiac-roles/target";

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

const functionParamsText = computed(() =>
  props.func ? getParamsTypesTitle(props.func) : "(function not found in ABI)",
)
</script>

<style lang="scss" scoped>
.permission_target_function {
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
}
</style>
