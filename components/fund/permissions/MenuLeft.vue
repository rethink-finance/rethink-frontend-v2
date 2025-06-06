<template>
  <div class="permissions_menu">
    <div class="permissions_menu__section">
      <strong>Members</strong>
      <div class="permissions__list">
        <div v-if="disabled && !allMembers?.length">
          No members yet.
        </div>
        <div
          v-for="memberAddress in allMembers"
          :key="memberAddress"
          class="permissions_menu__list_item"
          :class="memberClasses(memberAddress)"
        >
          <PermissionAddressLabelTooltip
            :label="addressLabels[memberAddress]"
            :address="memberAddress"
          />
          {{ addressLabels[memberAddress] || truncateAddress(memberAddress) }}
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

    <div class="permissions_menu__section">
      <strong>Targets</strong>
      <div class="permissions__list">
        <div v-if="disabled && !allTargets?.length">
          No targets yet.
        </div>
        <div
          v-for="target in allTargets"
          :key="target.id"
          class="permissions_menu__list_item"
          :class="targetClasses(target)"
          @click="setSelectedTarget(target.id)"
        >
          <div class="permissions_menu__list_item_label">
            <PermissionAddressLabelTooltip
              :label="addressLabels[target.address]"
              :address="target.address"
            />
            {{ addressLabels[target.address] || truncateAddress(target.address) }}
          </div>

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
import { useFundStore } from "~/store/fund/fund.store";
import { type RoleStoreType, useRoleStore } from "~/store/role/role.store";
import type { ChainId } from "~/types/enums/chain_id";
import {
  ConditionType,
  EntityStatus, ExecutionOption,
} from "~/types/enums/zodiac-roles";
import type { Role, Target } from "~/types/zodiac-roles/role";
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
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
const fundStore = useFundStore();
const addressLabels = ref<Record<string, string>>({})
const isAddMemberModalOpen = ref(false);
const isAddTargetModalOpen = ref(false);

const roleStore = useRoleStore();
const { getTargetStatus, getMemberStatus, activeTargetId } = storeToRefs(roleStore);

const allTargets = computed(() => [...roleStore.targets.list, ...roleStore.targets.add]);
const allMembers = computed(() => [...roleStore.members.list, ...roleStore.members.add]);

// Set selected target & initialize its local conditions.
const setSelectedTarget = (newTargetId: string) => {
  activeTargetId.value = newTargetId;
};

const targetClasses = (target: Target) => {
  const targetStatus = getTargetStatus.value(target);
  return [
    { "permissions_menu__list_item--deleted": targetStatus === EntityStatus.REMOVE },
    { "permissions_menu__list_item--new": targetStatus === EntityStatus.PENDING },
    { "permissions_menu__list_item--selected": target.id === activeTargetId.value },
  ];
};
const memberClasses = (memberAddress: string) => {
  const memberStatus = getMemberStatus.value(memberAddress);
  return [
    { "permissions_menu__list_item--deleted": memberStatus === EntityStatus.REMOVE },
    { "permissions_menu__list_item--new": memberStatus === EntityStatus.PENDING },
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

watchEffect(async () => {
  for (const target of allTargets.value) {
    const label = await fundStore.getAddressLabel(target.address, props.chainId)
    if (label) addressLabels.value[target.address] = label
  }
})
</script>

<style lang="scss" scoped>
.permissions_menu {
  width: 100%;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__list_item {
    border: 1px solid $color-border-dark;
    padding: 0.5rem;
    background-color: $color-hover;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &:hover {
      background-color: $color-moonlight-dark;
      cursor: pointer;
    }
    &--selected {
      background-color: $color-moonlight-light;
      font-weight: bold;
      &:hover {
        background-color: $color-moonlight-light;
        cursor: auto;
      }
    }
    &--deleted {
      color: $color-disabled;
      //color: $color-error;
    }
    &--new {
      color: $color-success;
    }
  }
  &__list_item_label {
    @include ellipsis;
    flex: 1;
    margin-right: 0.5rem;
  }
}
</style>
