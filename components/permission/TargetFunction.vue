<template>
  <div class="permission_target_function">
    <span class="permission_target_function__params">
      <pre class="permissions__json">{{ JSON.stringify(condition, null, 4) }}</pre>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import type { FunctionCondition, TargetConditions } from "~/types/zodiac-roles/role";

const props = defineProps({
  func: {
    type: Object as PropType<FunctionFragment>,
    default: () => {},
  },
  condition: {
    type: Object as PropType<FunctionCondition>,
    default: () => {},
  },
});
</script>

<style lang="scss" scoped>
.permission_target_function {
  &__json {
    color: #dcdcaa;
    padding: 10px;
    font-size: 0.85rem;
    white-space: pre-wrap;
    background-color: $color-badge-navy;
    border: 1px solid $color-gray-transparent;
    margin-top: 2rem;
  }
}
</style>
