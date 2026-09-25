import { useFundStore } from "../fund.store";
import { fetchModuleAvatar } from "~/composables/permissions/useRoleExecution";
import { useWeb3Store } from "~/store/web3/web3.store";
import { patchCachedFundOverview } from "~/store/funds/fundOverviewCache";

/**
 * Which of the Safe's modules is the Roles modifier. Every Rethink Safe has
 * the vault contract enabled as a module too (that is how executeNAVUpdate
 * and the flows reach it), and a Safe can carry others (a bridge, a recovery
 * module) — while every proposal that touches permissions encodes calls to
 * whatever address this returns. So take the module whose avatar() is this
 * Safe, the one getter both Roles generations share; the vault has no such
 * getter and answers with a revert.
 *
 * "" means the Safe has no Roles modifier. When the probe could not be made
 * at all (no RPC answering) the historical guess — the second module — is
 * kept, so an RPC outage does not get cached as "no modifier".
 */
export const pickRolesModifier = async (
  chainId: any,
  safeAddress: string | undefined,
  modules: string[],
): Promise<string> => {
  if (!modules.length) return "";
  if (!safeAddress) return modules[1] ?? "";
  let probeFailed = false;
  for (const module of modules) {
    try {
      const avatar = await fetchModuleAvatar(chainId, module);
      if (avatar && avatar.toLowerCase() === safeAddress.toLowerCase()) {
        return module;
      }
    } catch (error) {
      probeFailed = true;
      console.warn(`Could not probe module ${module}`, error);
    }
  }
  return probeFailed ? modules[1] ?? "" : "";
};

export const fetchRoleModAddressAddressAction = async (fundAddress: string): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  if (!fundAddress) return "";

  // If we have already fetched the role mod address for the current fund, just return it.
  let roleModAddress = fundStore.fundRoleModAddress[fundAddress];
  if (roleModAddress) {
    return roleModAddress;
  }

  // A vault whose settings.safe is not a contract (an EOA — e.g. after a
  // governance proposal repointed the Safe, as happened to TTAI on Arbitrum
  // in 2026-09) has no modules to page through. Asking it anyway makes every
  // RPC return empty bytes, the ABI decode throw, and the retry helper walk
  // the whole RPC list before failing. Settle it with one getCode instead.
  const chainId = fundStore.selectedFundChain;
  const safeAddress = fundStore.fund?.safeAddress;
  if (safeAddress) {
    const code = await web3Store.callWithRetry(
      chainId,
      () => web3Store.chainProviders[chainId].eth.getCode(safeAddress),
    );
    if (!code || code === "0x") {
      console.warn(
        `Safe ${safeAddress} has no code on chain ${chainId}; no Roles modifier`,
      );
      fundStore.fundRoleModAddress[fundAddress] = "";
      return "";
    }
  }

  // If the role modifier address was not fetched yet, fetch it now.
  const startAddress = "0x0000000000000000000000000000000000000001";
  /*
  function getModulesPaginated(
    address start,
    uint256 pageSize
  )
   */
  const safeModules = await web3Store.callWithRetry(
    fundStore.selectedFundChain,
    () =>
      fundStore.fundSafeContract.methods
        .getModulesPaginated(startAddress, 10)
        .call(),
  );
  const modules: string[] = Array.from(safeModules[0] ?? []);
  roleModAddress = await pickRolesModifier(chainId, safeAddress, modules);
  fundStore.fundRoleModAddress[fundAddress] = roleModAddress;
  // Display only: the Contracts card shows this while the Safe is asked again.
  if (roleModAddress) {
    patchCachedFundOverview(fundStore.selectedFundChain, fundAddress, {
      roleModAddress,
    });
  }
  return roleModAddress;
};
