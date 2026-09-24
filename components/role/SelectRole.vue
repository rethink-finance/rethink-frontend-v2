<template>
  <div class="select_role">
    <strong class="select_role__label">Role</strong>
    <UiSegmented
      v-if="roles.length > 1"
      :model-value="modelValue?.id ?? ''"
      :options="options"
      @update:model-value="select"
    />
    <strong v-else>
      {{ modelValue?.name }}
    </strong>
  </div>
</template>

<script setup lang="ts">
import UiSegmented from "~/components/global/ui/Segmented.vue";
import type { Role } from "~/types/zodiac-roles/role";

/**
 * Which of the modifier's roles the page is showing. Most modifiers carry a
 * single role, which is simply named; when there are several, every role is
 * listed side by side so the others are visible at a glance rather than
 * folded into a dropdown.
 */
const props = defineProps<{
  roles: Role[];
  modelValue: Role | undefined;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: Role | undefined): void;
}>();

const options = computed(() =>
  props.roles.map((role) => ({ key: role.id, label: role.name })),
);

const select = (id: string) =>
  emit("update:modelValue", props.roles.find((role) => role.id === id));
</script>

<style scoped lang="scss">
.select_role {
  display: flex;
  align-items: center;
  gap: 0.625rem;

  &__label {
    white-space: nowrap;
  }
}
</style>
