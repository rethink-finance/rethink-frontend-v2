<template>
  <div>
    <v-alert
      v-if="errorMessage"
      color="warning"
      class="pa-3 mb-4 text-pre-line"
    >
      <template #text>
        <strong>{{ errorMessage }}</strong>
      </template>
    </v-alert>
    <div class="permissions">
      <v-overlay
        :model-value="isLoading"
        class="d-flex justify-center align-center permissions__overlay"
        opacity="0.12"
        contained
        persistent
        absolute
      >
        <v-progress-circular
          class="stepper_onboarding__loading_spinner"
          size="70"
          width="3"
          indeterminate
        />
      </v-overlay>

      <template v-if="!isLoading">
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
          :is-error-state="!!errorMessage"
        />
        <div v-else class="text-center w-100 align-content-center">
          Select or add a new target.
        </div>
      </template>
    </div>
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
  errorMessage: {
    type: String,
    default: "",
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

  &__overlay {
    min-height: 30rem;
  }
  &__menu_left {
    display: flex;
    flex-direction: column;
    width: 20rem;
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
