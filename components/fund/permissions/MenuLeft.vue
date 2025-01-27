<template>
  <div class="permissions__menu_left">
    <div
      class="permissions__menu_section"
    >
      <strong>Role #{{ role.name }}</strong>
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
          class="permissions__list_item"
        >
          {{ truncateAddress(target.address) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {  Role } from "~/types/zodiac-roles/role";
import { truncateAddress } from "~/composables/addressUtils";

const props = defineProps({
  role: {
    type: Object as PropType<Role>,
    default: () => {},
  },
});
// TODO emit selected target
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
