<template>
  <div>
    <div v-if="errorMessage" class="brand_note brand_note--warning mb-4">
      <Icon
        icon="material-symbols:warning-outline"
        class="brand_note__icon"
      />
      <div class="brand_note__body">
        <div class="brand_note__text">
          {{ errorMessage }}
        </div>
      </div>
    </div>
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
    border-right: 1px solid $color-line;
    padding: 0.5rem 1rem 0.5rem 0;
  }
  &__content {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    margin-left: 1rem;
  }
}
</style>
