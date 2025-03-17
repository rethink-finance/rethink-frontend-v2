<template>
  <div class="page-permissions">
    <UiMainCard>
      <div class="info_container">
        <div class="info_container__buttons">
          <div class="d-flex align-center">
            <strong>Role #</strong>
            <v-select
              v-if="roles.length > 1"
              v-model="selectedRole"
              :items="roles"
              item-title="name"
              density="compact"
              variant="outlined"
              hide-details
              required
              return-object
            />
            <strong v-else>
              {{ selectedRole?.name }}
            </strong>
          </div>

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

      <!-- Permissions loaded from zodiac roles modifier -->
      <!-- TODO here it flickers as we first have to fetch fundData and then roleModAddress, prevent flickering -->
      <FundPermissions
        v-if="roles.length"
        class="mt-6"
        :chain-id="fund.chainId"
        :disabled="isEditDisabled"
        :is-loading="isFetchingPermissions"
      />
    </UiMainCard>
  </div>
</template>

<script setup lang="ts">
// types
import type IFund from "~/types/fund";
// components
import { fetchRoles } from "~/services/zodiac-subgraph";
import { useActionState, useActionStateStore } from "~/store/actionState.store";
import { useFundStore } from "~/store/fund/fund.store";
import { usePermissionsProposalStore } from "~/store/governance-proposals/permissions_proposal.store";
import { useRoleStore } from "~/store/role/role.store";
import { ChainId } from "~/types/enums/chain_id";
import type { Role } from "~/types/zodiac-roles/role";

const router = useRouter();
const fundStore = useFundStore();
const permissionsProposalStore = usePermissionsProposalStore();
const actionStateStore = useActionStateStore();
// Provide the store to child components
const roleStore = useRoleStore();
provide("roleStore", roleStore);

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(useFundStore());

const roles = ref<Role[]>([]);
const selectedRole = ref<Role | undefined>(undefined)
const isEditDisabled = ref(true);

// This is Rethink.finance specific thing now, to hardcode select condition
// with ID "1". We have to remove this and always select the first one.
const roleNumberOne = computed<Role|undefined>(
  () => roles.value.filter(role => role.name === "1")[0],
);

const updateGnosisLink = async () => {
  if (!fund?.address) {
    roles.value = [];
    return;
  }

  try {
    const roleModAddress = await fundStore.getRoleModAddress(fund.address);
    await fetchPermissions(roleModAddress);
  } catch (error) {
    console.error(error);
  }
};

const isFetchingPermissions = computed(() =>
  actionStateStore.isActionStateLoading("fetchRolesAction"),
);

// TODO move this into roles store.
function fetchRolesAction(chainId: ChainId, rolesModAddress: string): Promise<Role[]> {
  return useActionState("fetchRolesAction", () =>
    fetchRoles(chainId, rolesModAddress),
  );
}

const fetchPermissions = async (rolesModAddress: string) => {
  roles.value = await fetchRolesAction(fund.chainId, rolesModAddress);
  console.log("Fetched Roles", toRaw(roles.value));
}

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

// Whenever role changes reset role store and populate it with this role data.
// Watch for `roles` change and preselect a role.
watch(() => roles.value.length, () => {
  // Pre-select Role with ID: "1" as we use this one now everywhere.
  // This is hardcoded now at many places and needs
  // to be adjusted as any ID can be used.
  if (roles.value.length) {
    selectedRole.value = roleNumberOne.value || roles.value[0];
  } else {
    selectedRole.value = undefined;
  }
});
watch(() => selectedRole.value, () => {
  // Pre-select Role with ID: "1" as we use this one now everywhere.
  // This is hardcoded now at many places and needs
  // to be adjusted as any ID can be used.
  console.log("selectedRole.value", selectedRole.value);
  roleStore.initRoleState(
    roleStore.getRoleId(selectedRole.value?.name, roles.value),
    toRaw(selectedRole.value),
  );

  roleStore.activeTargetId = selectedRole.value?.targets?.[0].id;
});

watch(
  () => [fund.chainShort, fundStore.getRoleModAddress],
  () => {
    updateGnosisLink();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
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
