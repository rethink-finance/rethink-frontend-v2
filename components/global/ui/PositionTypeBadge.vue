<template>
  <div class="position_type" :class="positionTypeClass">
    {{ positionType?.name || "N/A" }}
  </div>
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
},
);
</script>

<style scoped lang="scss">
.position_type {
  display: flex;
  padding: 0.25rem;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  width: max-content;

  @include borderGray;
  background: $color-badge-navy;

  &--disabled {
    opacity: 0.65;
  }
}
</style>
