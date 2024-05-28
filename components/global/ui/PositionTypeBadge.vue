<template>
  <UiTextBadge
    :value="positionType?.name || 'N/A'"
    :class="positionTypeClass"
    :disabled="disabled"
  />
</template>

<script setup lang="ts">

import type { PositionType } from "~/types/enums/position_type";

const props = defineProps({
  value: {
    type: String,
    default: undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const positionType = computed(() => props.value ? getPositionType(props.value as PositionType) : undefined);
const positionTypeClass = computed(() => {
  const baseClass = `position_type_${props.value as PositionType || "unknown"}`;
  return props.disabled ? `${baseClass} position_type--disabled` : baseClass;
});
</script>

<style scoped lang="scss">

</style>
