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
        :selected-target="selectedTarget"
        :role="selectedRole"
        @update:selected-target="setSelectedTarget"
      />

      <PermissionTarget
        v-if="selectedTarget"
        v-model:conditions="localConditions[selectedTarget.address]"
        class="permissions__content"
        :target="selectedTarget"
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
// Local reactive copy for target conditions (mapped by target address)
const localConditions = ref<Record<string, TargetConditions>>({});

const selectedRole = ref<Role | undefined>();
const selectedTarget = ref<Target | undefined>();

// This is Rethink.finance specific thing now, to hardcode select condition
// with ID "1". We have to remove this and always select the first one.
const roleNumberOne = computed<Role|undefined>(
  () => props.roles.filter(role => role.name === "1")[0],
);

// Set selected target & initialize its local conditions.
const setSelectedTarget = (newTarget: Target) => {
  console.log("[0] setSelectedTarget", toRaw(newTarget));
  selectedTarget.value = newTarget;
  if (!localConditions.value[newTarget.address]) {
    localConditions.value[newTarget.address] = { ...newTarget.conditions };
  }
};

// Watch for `roles` change and preselect a role & target
watch(() => props.roles.length, () => {
  // Pre-select Role with ID: "1" as we use this one now everywhere.
  // This is hardcoded now at many places and needs
  // to be adjusted as any ID can be used.
  if (props.roles.length) {
    selectedRole.value = roleNumberOne.value || props.roles[0];
    setSelectedTarget(selectedRole.value?.targets[0]);
  } else {
    selectedRole.value = undefined;
    selectedTarget.value = undefined;
  }
});

// Watch for target changes and update `localConditions` accordingly
watch(
  selectedTarget,
  (newTarget) => {
    if (newTarget && !localConditions.value[newTarget.address]) {
      localConditions.value[newTarget.address] = { ...newTarget.conditions };
    }
  },
  { deep: true, immediate: true },
);
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
