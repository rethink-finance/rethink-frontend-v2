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
      <div class="permissions__menu_left">
        <FundPermissionsMenuLeft
          :selected-target="activeTargetId"
          :role="roleStore.role"
          :disabled="disabled"
          :chain-id="chainId"
        />
      </div>
      <PermissionTarget
        v-if="activeTargetId"
        class="permissions__content"
        :disabled="disabled"
        :chain-id="chainId"
      />
      <div v-else>
        Select a target.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useRoleStore } from "~/store/role/role.store";
import type { ChainId } from "~/types/enums/chain_id";

defineProps({
  chainId: {
    type: String as PropType<ChainId>,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
const roleStore = useRoleStore();
const { activeTargetId } = storeToRefs(roleStore);
</script>

<style lang="scss" scoped>
.permissions {
  display: flex;
  flex-direction: row;

  &__menu_left {
    display: flex;
    flex-direction: column;
    max-width: 30%;
    min-width: 15rem;
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
