<template>
  <div class="d-flex align-center">
    <strong>Role &nbsp;</strong>
    <v-select
      v-if="roles.length > 1"
      :model-value="modelValue"
      :items="roles"
      item-title="name"
      density="compact"
      variant="outlined"
      hide-details
      required
      return-object
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <strong v-else>
      {{ modelValue?.name }}
    </strong>
  </div>
</template>

<script setup lang="ts">
import type { Role } from "~/types/zodiac-roles/role";

defineProps<{
  roles: Role[];
  modelValue: Role | undefined;
}>();

defineEmits<{
  (e: "update:modelValue", value: Role | undefined): void;
}>();
</script>
