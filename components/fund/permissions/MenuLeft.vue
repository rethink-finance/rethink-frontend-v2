<template>
  <div class="permissions__menu_left">
    <div
      class="permissions__menu_section"
    >
      <!-- TODO Convert this to select input to select roles-->
      <strong>Role #{{ role?.name }}</strong>
    </div>
    <div
      class="permissions__menu_section"
    >
      <strong>Members</strong>
      <div
        class="permissions__list"
      >
        <div
          v-for="member in role?.members || []"
          :key="member.id"
          class="permissions__list_item"
        >
          {{ truncateAddress(member.address) }}
        </div>
      </div>
    </div>

    <div
      class="permissions__menu_section"
    >
      <strong>Targets</strong>
      <div
        class="permissions__list"
      >
        <div
          v-for="target in role?.targets || []"
          :key="target.id"
          :class="classesTarget(target)"
          @click="emitSelectedTarget(target)"
        >
          {{ truncateAddress(target.address) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import type { Role, Target } from "~/types/zodiac-roles/role";

const emit = defineEmits(["update:selectedTarget"]);

const props = defineProps({
  role: {
    type: Object as PropType<Role>,
    default: () => {},
  },
  selectedTarget: {
    type: Object as PropType<Target>,
    default: () => {},
  },
});

const emitSelectedTarget = (selectedTarget: Target) => {
  emit("update:selectedTarget", selectedTarget);
}

const classesTarget = (target: Target) => {
  return [
    "permissions__list_item",
    { "permissions__list_item--selected": target.address === props.selectedTarget.address },
  ];
};
</script>

<style lang="scss" scoped>
.permissions {
  display: flex;

  &__menu_section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
