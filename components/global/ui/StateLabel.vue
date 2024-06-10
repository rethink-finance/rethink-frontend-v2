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
});

const positionType = computed(() => props.value ? getPositionType(props.value as PositionType) : undefined);
const positionTypeClass = computed(() => `position_type_${props.value as PositionType || "unknown"}`);
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
  }
  </style>
