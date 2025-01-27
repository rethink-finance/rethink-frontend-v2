<template>
  <div class="permissions">
    <!-- TODO Convert this to select input to select roles-->
    <!--    <strong>Selected Role:</strong> {{ roleNumberOne?.id }}-->

    <FundPermissionsMenuLeft
      class="permissions__menu_left"
      :role="roleNumberOne"
    />

    <FundPermissionsTarget
      v-if="selectedTarget"
      class="permissions__content"
      :target="selectedTarget"
    />
    <!-- TODO make this progress spinner in center of div -->
    <div v-else-if="isFetchingPermissions">
      Loading permissions...
      <v-progress-circular
        class="d-flex"
        size="32"
        width="3"
        indeterminate
      />
    </div>
    <div v-else>
      No Roles/Permissions Found
    </div>
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
const selectedTarget = ref<Target | undefined>();

const isFetchingPermissions = computed(() =>
  actionStateStore.getActionState("fetchFundPermissionsAction"),
);
// Return Permissions of Role with ID: "1" as we use this one now
// everywhere with Rethink. This is Hardcoded now at many places and needs
// to be adjusted as any ID can be used.
// TODO maybe just use the select dropdown to select ROLE
const roleNumberOne = computed<Role|undefined>(
  () => props.roles.filter(role => role.name === "1")[0],
);

watch(() => roleNumberOne.value, () => {
  // TODO instead of roleNumberOne, just do watcher on props.roles.length and
  //   select the role with ID "1" if none is selected yet.
  selectedTarget.value = roleNumberOne.value?.targets[0];
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
    border: 1px solid $color-border-light;
    padding: 0.5rem;
    background-color: $color-moonlight-dark;

    &:hover {
      background-color: $color-hover;
      cursor: pointer;
    }
  }
}
</style>
