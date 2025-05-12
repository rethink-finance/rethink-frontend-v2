import { ref, computed, watch, toRaw } from "vue";
import { useActionState, useActionStateStore } from "~/store/actionState.store";
import { fetchRoles } from "~/services/zodiac-subgraph";
import type { Role } from "~/types/zodiac-roles/role";
import { ChainId } from "~/types/enums/chain_id";
import { GovernableFund } from "assets/contracts/GovernableFund";
import { useRoleStore } from "~/store/role/role.store";

export function useRoles(fundChainId: ChainId, fundAddress: string | undefined) {
  const roleStore = useRoleStore();
  const actionStateStore = useActionStateStore();

  const roles = ref<Role[]>([]);
  const selectedRole = ref<Role | undefined>(undefined);
  const isEditDisabled = ref(true);

  const roleNumberOne = computed(() =>
    roles.value.find(role => role.name === "1"),
  );

  const isFetchingPermissions = computed(() =>
    actionStateStore.isActionStateLoading("fetchRolesAction"),
  );

  function fetchRolesAction(chainId: ChainId, rolesModAddress: string) {
    return useActionState("fetchRolesAction", () =>
      fetchRoles(chainId, rolesModAddress),
    );
  }

  const fetchPermissions = async (rolesModAddress: string | undefined) => {
    roles.value = [];
    if (rolesModAddress) {
      roles.value = await fetchRolesAction(fundChainId, rolesModAddress);
      console.log("Fetched Roles", toRaw(roles.value));
    }
  };

  watch(() => roles.value.length, () => {
    selectedRole.value = roleNumberOne.value || roles.value[0];
  });

  watch(() => selectedRole.value, () => {
    roleStore.initRoleState(
      roleStore.getRoleId(selectedRole.value?.name, roles.value),
      toRaw(selectedRole.value),
    );
    roleStore.activeTargetId = selectedRole.value?.targets?.[0]?.id;
  });

  watch(
    () => fundAddress,
    () => {
      if (fundAddress) {
        roleStore.customAbiMap[fundAddress.toLowerCase()] = JSON.parse(JSON.stringify(GovernableFund.abi));
      }
    },
    { immediate: true },
  );

  return {
    roles,
    selectedRole,
    isEditDisabled,
    isFetchingPermissions,
    fetchPermissions,
  };
}
