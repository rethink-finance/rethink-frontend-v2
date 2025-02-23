<template>
  <div>
    <div class="permissions__menu_section">
      <!-- TODO Convert this to select input to select roles-->
      <strong>Role #{{ role?.name }}</strong>
    </div>
    <div class="permissions__menu_section">
      <strong>Members</strong>
      <div class="permissions__list">
        <div
          v-for="memberAddress in allMembers"
          :key="memberAddress"
          class="permissions__list_item"
          :class="memberClasses(memberAddress)"
        >
          {{ truncateAddress(memberAddress) }}
          <template v-if="!disabled">
            <UiButtonDelete
              v-if="getMemberStatus(memberAddress) === EntityStatus.REMOVE"
              xs
              is-undo
              @click.stop="roleStore.handleRemoveMember(memberAddress, false)"
            />
            <UiButtonDelete
              v-else
              xs
              @click.stop="roleStore.handleRemoveMember(memberAddress)"
            />
          </template>
        </div>
      </div>
      <div class="mx-auto my-2">
        <UiButtonAddRow
          v-if="!disabled"
          class="ms-3 mt-2"
          @click="isAddMemberModalOpen = true"
        >
          Add Member
        </UiButtonAddRow>
        <FundPermissionsAddAddressModal
          v-model="isAddMemberModalOpen"
          type="Member"
          @address-added="roleStore.handleAddMember"
        >
          <template #description>
            Members are accounts that that the role is assigned to.
          </template>
        </FundPermissionsAddAddressModal>
      </div>
    </div>

    <div class="permissions__menu_section">
      <strong>Targets</strong>
      <div class="permissions__list">
        <div
          v-for="target in allTargets"
          :key="target.id"
          class="permissions__list_item"
          :class="targetClasses(target)"
          @click="setSelectedTarget(target.id)"
        >
          {{ truncateAddress(target.address) }}
          <template v-if="!disabled">
            <UiButtonDelete
              v-if="getTargetStatus(target) === EntityStatus.REMOVE"
              xs
              is-undo
              @click.stop="roleStore.handleRemoveTarget(target, false)"
            />
            <UiButtonDelete
              v-else
              xs
              @click.stop="roleStore.handleRemoveTarget(target)"
            />
          </template>
        </div>
      </div>
      <div class="mx-auto my-2">
        <UiButtonAddRow
          v-if="!disabled"
          class="ms-3 mt-2"
          @click="isAddTargetModalOpen = true"
        >
          Add Target
        </UiButtonAddRow>
        <FundPermissionsAddAddressModal
          v-model="isAddTargetModalOpen"
          type="Target"
          @address-added="addNewTarget"
        >
          <template #description>
            Targets are the accounts that the members can interact with on behalf of the avatar.
          </template>
        </FundPermissionsAddAddressModal>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { truncateAddress } from "~/composables/addressUtils";
import type { Role, Target } from "~/types/zodiac-roles/role";
import type { RoleStoreType } from "~/store/role/role.store";
import {
  ConditionType,
  EntityStatus, ExecutionOption,
} from "~/types/enums/zodiac-roles";
const emit = defineEmits(
  [
    "targetRemoved",
  ],
);

const props = defineProps({
  role: {
    type: Object as PropType<Role>,
    default: () => {},
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
const isAddMemberModalOpen = ref(false);
const isAddTargetModalOpen = ref(false);

// Inject the Role Store
const roleStore = inject<RoleStoreType>("roleStore");
if (!roleStore) {
  throw new Error("roleStore is not provided!");
}
const { getTargetStatus, getMemberStatus, activeTargetId } = storeToRefs(roleStore);

const allTargets = computed(() => [...roleStore.targets.list, ...roleStore.targets.add]);
const allMembers = computed(() => [...roleStore.members.list, ...roleStore.members.add]);

// Set selected target & initialize its local conditions.
const setSelectedTarget = (newTargetId: string) => {
  activeTargetId.value = newTargetId;
};

const targetClasses = (target: Target) => {
  return [
    { "permissions__list_item--deleted": getTargetStatus.value(target) === EntityStatus.REMOVE },
    { "permissions__list_item--selected": target.id === activeTargetId.value },
  ];
};
const memberClasses = (memberAddress: string) => {
  return [
    { "permissions__list_item--deleted": getMemberStatus.value(memberAddress) === EntityStatus.REMOVE },
  ];
};

const addNewTarget = (newTargetAddress: string) => {
  console.warn("NEW);", newTargetAddress)
  roleStore.handleAddTarget(
    {
      id: `${newTargetAddress}_${Date.now()}`,
      address: newTargetAddress,
      type: ConditionType.WILDCARDED,
      executionOption: ExecutionOption.NONE,
      conditions: {},
    } as Target,
  )
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
