import { findActivationProposals } from "~/composables/permissions/pendingActivationProposal";
import {
  listLiveRoleKeys,
  reduceRoleScopeLogs,
} from "~/composables/permissions/roleScopeLogs";
import { UPDATE_SETTINGS_SELECTOR } from "~/composables/permissions/rolesV2Permissions";
import { fetchRoleScopeLogs } from "~/services/onchain/roleScopes";
import { useGovernanceProposalsStore } from "~/store/governance-proposals/governance_proposals.store";
import type { ChainId } from "~/types/enums/chain_id";

export interface IActivationVault {
  chainId: ChainId;
  fundAddress: string;
  rolesModifier: string | null;
  safe: string;
}

/**
 * Live activation proposals for a vault, off the governance store (hydrated
 * from cache, refreshed on demand), so a page can say one is up for vote
 * instead of offering a second, conflicting one.
 */
export const useActivationProposals = (vault: () => IActivationVault | null) => {
  const store = useGovernanceProposalsStore();
  const proposals = computed(() => {
    const current = vault();
    if (!current?.safe) return {};
    return findActivationProposals(
      store.getProposals(current.chainId, current.fundAddress),
      current,
    );
  });
  /** Soft fails: the cached list (or none) is what callers go by then. */
  const refresh = async () => {
    try {
      await store.fetchGovernanceProposals();
    } catch (error) {
      console.warn("Failed reading proposals for the activation check", error);
    }
  };
  return { proposals, refresh };
};

/**
 * Whether any live role may call updateSettings on the vault: the permission
 * behind the curator whitelist and profile pages. Null when the modifier's
 * history cannot be read.
 */
export const fetchSettingsPermissionGranted = async (
  chainId: ChainId,
  fundAddress: string,
  rolesModifier: string,
): Promise<boolean | null> => {
  try {
    const logs = await fetchRoleScopeLogs(chainId, rolesModifier);
    return listLiveRoleKeys(logs).some((key) =>
      reduceRoleScopeLogs(logs, key).scopes.some(
        (scope) =>
          scope.target.toLowerCase() === fundAddress.toLowerCase() &&
          scope.selector.toLowerCase() === UPDATE_SETTINGS_SELECTOR,
      ),
    );
  } catch (error) {
    console.warn("Could not read the roles' scopes", error);
    return null;
  }
};
