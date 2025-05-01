import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchRoleModAddressAddressAction = async (fundAddress: string): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();
  if (!fundAddress) return "";

  // If we have already fetched the role mod address for the current fund, just return it.
  let roleModAddress = fundStore.fundRoleModAddress[fundAddress];
  if (roleModAddress) {
    return roleModAddress;
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
  return roleModAddress;
};
