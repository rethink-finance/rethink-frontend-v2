<template>
  <div class="permissions">
    <!-- Convert this to select input to select roles-->
    <!--    <strong>Selected Role:</strong> {{ roleNumberOne?.id }}-->

    <div class="permissions__menu_left">
      <div
        class="permissions__menu_section"
      >
        <strong>Members</strong>
        <div
          class="permissions__list"
        >
          <div
            v-for="member in roleNumberOne?.members || []"
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
            v-for="target in roleNumberOne?.targets || []"
            :key="target.id"
            class="permissions__list_item"
          >
            {{ truncateAddress(target.address) }}
          </div>
        </div>
      </div>
    </div>

    <div class="permissions__content">
      Content
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFundStore } from "~/store/fund/fund.store";
import type { Role } from "~/types/zodiac-roles/role";
import { truncateAddress } from "~/composables/addressUtils";
const fundStore = useFundStore();

const props = defineProps({
  roles: {
    type: Array as () => Role[],
    default: () => [],
  },
});

const fund = fundStore.fund;

// Return Permissions of Role with ID: "1" as we use this one now
// everywhere with Rethink. This is Hardcoded now at many places and needs
// to be adjusted as any ID can be used.
// TODO maybe just use the select dropdown to select ROLE
const roleNumberOne = computed<Role|undefined>(
  () => props.roles.filter(role => role.name === "1")[0],
);
</script>

<style lang="scss" scoped>
.permissions {
  display: flex;
  flex-wrap: wrap;

  &__menu_left {
    display: flex;
    flex-direction: column;
    max-width: 30%;
    min-width: 20%;
    gap: 1.5rem;
  }
  &__content {
    display: flex;
    flex-direction: column;
  }
  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  &__list_item {
    display: flex;
    border: 1px solid $color-text-irrelevant;
    background-color: transparent;
    padding: 0.5rem;
  }

}
</style>
