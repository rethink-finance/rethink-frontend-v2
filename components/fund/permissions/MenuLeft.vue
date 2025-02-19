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
          @click="emitSelectedTarget(target.id)"
        >
          {{ truncateAddress(target.address) }}
          <template v-if="!disabled">
            <UiDeleteButton
              v-if="getTargetStatus(target) === EntityStatus.REMOVE"
              xs
              is-undo
              @click.stop="roleStore.handleRemoveTarget(target, false)"
            />
            <UiDeleteButton
              v-else
              xs
              @click.stop="roleStore.handleRemoveTarget(target)"
            />
          </template>
        </div>
      </div>
      <div class="mx-auto my-2">
        <v-btn
          variant="outlined"
          size="small"
          class="ms-2 mt-2 app_btn_small"
          @click="addNewTarget"
        >
          <template #prepend>
            <Icon
              icon="octicon:plus-16"
              height="1rem"
              width="1rem"
            />
          </template>
          Add Target
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import type { Role, Target } from "~/types/zodiac-roles/role";
import type { RoleStoreType } from "~/store/role/role.store";
import {
  EntityStatus,
} from "~/types/enums/zodiac-roles";
const emit = defineEmits(
  [
    "update:selectedTarget",
    "targetRemoved",
  ],
);

const props = defineProps({
  role: {
    type: Object as PropType<Role>,
    default: () => {},
  },
  selectedTarget: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// Inject the Role Store
const roleStore = inject<RoleStoreType>("roleStore");
if (!roleStore) {
  throw new Error("roleStore is not provided!");
}
const { getTargetStatus } = storeToRefs(roleStore);

const emitSelectedTarget = (targetId: string) => {
  emit("update:selectedTarget", targetId);
}

const classesTarget = (target: Target) => {
  return [
    "permissions__list_item",
    { "permissions__list_item--deleted": getTargetStatus.value(target) === EntityStatus.REMOVE },
    { "permissions__list_item--selected": target.id === props.selectedTarget },
  ];
};

const addNewTarget = () => {
  console.log("new target");
}
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
