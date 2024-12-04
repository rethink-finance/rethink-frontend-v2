import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundDelegateAddressAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();

  fundStore.fundUserData.fundDelegateAddress = "";
  if (!fundStore.fund?.governanceToken?.address) {
    console.log("Fund governanceToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  console.warn("FETCH userFundDelegateAddress");

  fundStore.fundUserData.fundDelegateAddress = await web3Store.callWithRetry(
    fundStore.fundChainId,
    () =>
      fundStore.fundGovernanceTokenContract.methods
        .delegates(fundStore.activeAccountAddress)
        .call(),
  );
  console.warn(
    "FETCH userFundDelegateAddress",
    fundStore.fundUserData.fundDelegateAddress,
  );

  return fundStore.fundUserData.fundDelegateAddress;
};
