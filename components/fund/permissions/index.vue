<template>
  <div class="permissions">
    <!-- TODO make this progress spinner in center of div -->
    <div v-if="isLoading">
      Loading permissions...
      <v-progress-circular
        class="d-flex"
        size="32"
        width="3"
        indeterminate
      />
    </div>
    <template v-else>
      <FundPermissionsMenuLeft
        class="permissions__menu_left"
        :selected-target="activeTarget"
        :role="roleStore.role"
        @update:selected-target="setSelectedTarget"
      />
      <!--      TODO remove this JSON -->
      <!--      <div class="permissions__json" style="width: 650px;">-->
      <!--        <div>-->
      <!--          {{ roleStore.getActiveRole || "no target selected" }}-->
      <!--        </div>-->
      <!--      </div>-->
      <PermissionTarget
        v-if="roleStore.activeTarget"
        class="permissions__content"
        :chain-id="chainId"
      />
      <div v-else>
        Select a target.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChainId } from "~/store/web3/networksMap";
import type { Role, Target, TargetConditions } from "~/types/zodiac-roles/role";
import { useRoleStore } from "~/store/role/role.store";

const props = defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
  roles: {
    type: Array as () => Role[],
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const roleStore = useRoleStore();
const { activeTarget, getActiveRole } = storeToRefs(roleStore);

// Provide the store to child components
provide("roleStore", roleStore);

const selectedTarget = ref<Target | undefined>();

// This is Rethink.finance specific thing now, to hardcode select condition
// with ID "1". We have to remove this and always select the first one.
const roleNumberOne = computed<Role|undefined>(
  () => props.roles.filter(role => role.name === "1")[0],
);

// Set selected target & initialize its local conditions.
const setSelectedTarget = (newTargetId: string) => {
  console.log("[0] setSelectedTarget", toRaw(newTargetId));
  // selectedTarget.value = newTarget; // TODO remove this
  roleStore.activeTarget = newTargetId;
};

// TODO whenever role changes reset role store and populate it with this role data
// Watch for `roles` change and preselect a role & target
watch(() => props.roles.length, () => {
  // Pre-select Role with ID: "1" as we use this one now everywhere.
  // This is hardcoded now at many places and needs
  // to be adjusted as any ID can be used.
  if (props.roles.length) {
    const selectedRole = roleNumberOne.value || props.roles[0];
    roleStore.role = selectedRole;
    roleStore.initRoleState(
      roleStore.getRoleId(selectedRole.name, props.roles),
      toRaw(selectedRole),
    );

    setSelectedTarget(selectedRole?.targets[0].id);
  } else {
    roleStore.role = undefined;
    selectedTarget.value = undefined;
  }
});
</script>

<style lang="scss" scoped>
.permissions {
  display: flex;
  flex-direction: row;

  &__menu_left {
    display: flex;
    flex-direction: column;
    max-width: 30%;
    min-width: 12rem;
    gap: 1.5rem;
    margin-right: 1rem;
    border: 1px solid $color-border-dark;
    padding: 0.5rem;
  }
  &__content {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    margin-left: 1rem;
  }
}
</style>

<style lang="scss">
.permissions {
  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  &__list_item {
    display: flex;
    border: 1px solid $color-border-dark;
    padding: 0.5rem;
    background-color: $color-hover;

    &--selected {
      background-color: $color-moonlight-light;
      font-weight: bold;
      /* Disable hover effect for active items */
      pointer-events: none;
    }

    &:hover {
      background-color: $color-moonlight-dark;
      cursor: pointer;
    }
  }
  &__function {
    display: flex;
    flex-direction: row;
    align-content: center;
    align-items: center;
    font-family: monospace;
    white-space: normal;
    line-height: 1.2rem;
  }
  &__function_params {
    color: $color-steel-blue;
    margin-left: 0.3rem;
  }
  &__json {
    color: #dcdcaa;
    font-size: 0.85rem;
    white-space: pre-wrap;
    background-color: $color-badge-navy;
  }
}
</style>
