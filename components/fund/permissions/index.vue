<template>
  <div class="permissions">
    <!-- TODO make this progress spinner in center of div -->
    <!-- TODO here it flickers as we first have to fetch fundData and then roleModAddress, prevent flickering -->
    <div v-if="isFetchingPermissions">
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
        :role="selectedRole"
      />

      <FundPermissionsTarget
        v-if="selectedTarget"
        class="permissions__content"
        :target="selectedTarget"
      />
      <div v-else>
        Select a target.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Role, Target } from "~/types/zodiac-roles/role";
import { useActionStateStore } from "~/store/actionState.store";

const props = defineProps({
  roles: {
    type: Array as () => Role[],
    default: () => [],
  },
});

const actionStateStore = useActionStateStore();
const selectedRole = ref<Role | undefined>();
const selectedTarget = ref<Target | undefined>();

const isFetchingPermissions = computed(() =>
  actionStateStore.isActionStateLoading("fetchFundPermissionsAction"),
);

const roleNumberOne = computed<Role|undefined>(
  () => props.roles.filter(role => role.name === "1")[0],
);

watch(() => props.roles.length, () => {
  // Pre-select Role with ID: "1" as we use this one now everywhere.
  // This is hardcoded now at many places and needs
  // to be adjusted as any ID can be used.
  if (props.roles.length) {
    selectedRole.value = roleNumberOne.value || props.roles[0];
    selectedTarget.value = selectedRole.value?.targets[0];
  } else {
    selectedRole.value = undefined;
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

    &:hover {
      background-color: $color-moonlight-dark;
      cursor: pointer;
    }
  }
}
</style>
