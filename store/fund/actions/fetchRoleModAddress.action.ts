import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { patchCachedFundOverview } from "~/store/funds/fundOverviewCache";

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
  roleModAddress = safeModules[0][1];
  fundStore.fundRoleModAddress[fundAddress] = roleModAddress;
  // Display only: the Contracts card shows this while the Safe is asked again.
  if (roleModAddress) {
    patchCachedFundOverview(fundStore.selectedFundChain, fundAddress, {
      roleModAddress,
    });
  }
  return roleModAddress;
};
