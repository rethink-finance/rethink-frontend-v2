<template>
  <div class="permissions">
    <UiMainCard class="permissions__content">
      <div class="info_container">
        <div class="info_container__buttons">
          <div class="d-flex align-center">
            <div class="d-flex align-center me-6">
              <RoleSelectRole v-model="selectedRole" :roles="roles" />
            </div>
            <PermissionImportRawPermissions :disabled="isEditDisabled" />
          </div>

          <div v-if="appSettingsStore.isManageMode" class="is-manage-mode">
            <v-btn
              v-if="isEditDisabled"
              color="primary"
              @click="isEditDisabled = false"
            >
              Edit
            </v-btn>
            <div v-else>
              <v-btn
                color="primary"
                @click="navigateToCreatePermissions"
              >
                Create Permissions Proposal
              </v-btn>
              <v-btn
                variant="text"
                color="secondary"
                @click="isEditDisabled = true"
              >
                <Icon
                  icon="ic:twotone-cancel"
                  width="1.5rem"
                />
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Permissions loaded from zodiac roles modifier -->
      <!-- TODO here it flickers as we first have to fetch fundData and then roleModAddress, prevent flickering -->
      <FundPermissions
        class="mt-6"
        :chain-id="fund.chainId"
        :disabled="isEditDisabled"
        :is-loading="isLoading"
      />
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
import type IFund from "~/types/fund";
import { useFundStore } from "~/store/fund/fund.store";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import { useRoleStore } from "~/store/role/role.store";
import { useSettingsStore } from "~/store/settings/settings.store";
import { useRoles } from "~/composables/permissions/useRoles";
import { useToastStore } from "~/store/toasts/toast.store";
import PermissionImportRawPermissions from "~/components/permission/ImportRawPermissions.vue";
import RoleSelectRole from "~/components/role/SelectRole.vue";
import { ActionState } from "~/types/enums/action_state";
import { useActionStateStore } from "~/store/actionState.store";

const router = useRouter();
const fundStore = useFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const appSettingsStore = useSettingsStore();
const roleStore = useRoleStore();
const toastStore = useToastStore();
const actionStateStore = useActionStateStore();

const { selectedFundSlug } = storeToRefs(useFundStore());
const fund = useAttrs().fund as IFund;

const {
  roles,
  selectedRole,
  isEditDisabled,
  isFetchingPermissions,
  fetchPermissions,
} = useRoles(fund.chainId, fund.address);

const isLoading = computed(() =>
  isFetchingPermissions.value ||
  actionStateStore.isActionState("fetchRoleModAddressAddressAction", ActionState.Loading),
);

const fetchRolesAndPermissions = async () => {
  if (!fund?.address) {
    roles.value = [];
    return;
  }

  try {
    const roleModAddress = await fundStore.fetchRoleModAddress(fund.address);
    await fetchPermissions(roleModAddress);
  } catch (error) {
    console.error(error);
    toastStore.errorToast("Failed loading permissions. Please refresh page.");
  }
};

const navigateToCreatePermissions = async () => {
  try {
    permissionsProposalStore.rawTransactions = await roleStore.updateRole(fund.chainId);
  } catch (e: any) {
    console.error("Failed updating role", e);
  }

  router.push(
    `/details/${selectedFundSlug.value}/governance/delegated-permissions`,
  );
};

watch(
  () => [fund.chainShort, fundStore.fetchRoleModAddress],
  () => {
    fetchRolesAndPermissions();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.permissions {
  position: relative;

  &__content {
    min-height: 30rem;
  }
}
.info_container {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__text {
    font-size: $text-sm;
    color: $color-light-subtitle;
  }
  &__link {
    color: $color-primary;
    text-decoration: underline;
  }
  &__buttons {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;

    @include md {
      flex-direction: row;
    }
  }
}
</style>
