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
      <div
        class="permissions__menu_left"
      >
        <FundPermissionsMenuLeft
          :selected-target="activeTargetId"
          :role="roleStore.role"
          :disabled="disabled"
        />
        <v-btn @click="updateRole">
          Update Role
        </v-btn>
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
import type { ChainId } from "~/store/web3/networksMap";
import type { RoleStoreType } from "~/store/role/role.store";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import { useFundStore } from "~/store/fund/fund.store";

const props = defineProps({
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
const router = useRouter();
const { selectedFundSlug } = storeToRefs(useFundStore());
const permissionsProposalStore = usePermissionsProposalStore();

// Inject the Role Store
const roleStore = inject<RoleStoreType>("roleStore");
if (!roleStore) {
  throw new Error("roleStore is not provided!");
}
const { activeTargetId } = storeToRefs(roleStore);

// TODO emit update role event
const updateRole = async () => {
  try {
    permissionsProposalStore.rawTransactions = await roleStore.updateRole(props.chainId);
    router.push(
      `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
    );
  } catch (e: any) {
    console.error("Failed updating role", e);
  }
}
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
}
</style>
