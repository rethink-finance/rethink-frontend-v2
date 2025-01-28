<template>
  <div class="permission_target_function">
    <span>
      {{ func.name }}
    </span>
    <span class="permission_target_function__params">
      {{ getParamsTypesTitle(func as FunctionFragment) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { FunctionFragment } from "ethers";
import { getParamsTypesTitle } from "~/composables/zodiac-roles/target";

const props = defineProps({
  func: {
    type: Object as PropType<FunctionFragment>,
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
  &__params {
    color: $color-steel-blue;
    margin-left: 0.3rem;
  }
}
</style>
