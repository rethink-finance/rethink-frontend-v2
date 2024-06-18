<!-- TODO: make a generic chip component that extends position badge chip -->
<template>
  <div :class="statusTypeClass">
    {{ statusType?.name || "N/A" }}
  </div>
</template>

<script setup lang="ts">
import type { StatusType } from "~/types/enums/status_type";

const props = defineProps({
  value: {
    type: String,
    default: undefined,
  },
});

const statusType = computed(() =>
  props.value ? getStatusType(props.value as StatusType) : undefined
);
const statusTypeClass = computed(() => [
  "chip",
  `status_type_${(props.value as StatusType) || "unknown"}`,
]);
</script>

<style lang="scss" scoped>
.chip {
  display: inline-block;
  padding: 4px;
  border-radius: 0.25rem;
  background-color: $color-gray-light-transparent;

  font-weight: 800;
  font-size: 11px;
  line-height: 1;
  text-transform: uppercase;
}
</style>
