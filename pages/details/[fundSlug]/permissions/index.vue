<template>
  <div class="page-permissions">
    <UiMainCard>
      <div class="info_container">
        <div class="info_container__buttons">
          <v-btn color="primary" @click="navigateToCreatePermissions">
            Create Raw Permissions Proposal
          </v-btn>
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
import { useFundStore } from "~/store/fund/fund.store";
import type { Role } from "~/types/zodiac-roles/role";
import { useActionState, useActionStateStore } from "~/store/actionState.store";
import { ChainId } from "~/store/web3/networksMap";
import { useRoleStore } from "~/store/role/role.store";

const router = useRouter();
const fundStore = useFundStore();
const actionStateStore = useActionStateStore();
// Provide the store to child components
const roleStore = useRoleStore();
provide("roleStore", roleStore);

const fund = useAttrs().fund as IFund;
const { selectedFundSlug } = storeToRefs(useFundStore());

const roles = ref<Role[]>([]);
const isEditDisabled = ref(false);

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

const navigateToCreatePermissions = () => {
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
    const selectedRole = roleNumberOne.value || roles.value[0];
    roleStore.role = selectedRole;
    roleStore.initRoleState(
      roleStore.getRoleId(selectedRole.name, roles.value),
      toRaw(selectedRole),
    );

    roleStore.activeTargetId = selectedRole?.targets[0].id;
  } else {
    roleStore.role = undefined;
  }
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
  align-items: flex-end;
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
    gap: 1rem;

    @include md {
      flex-direction: row;
    }
  }
}
</style>
