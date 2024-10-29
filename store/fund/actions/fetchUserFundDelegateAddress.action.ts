import { useFundStore } from "../fund.store";

export const fetchUserFundDelegateAddressAction = async (): Promise<any> => {
  const fundStore = useFundStore();

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

  fundStore.fundUserData.fundDelegateAddress = await fundStore.callWithRetry(
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
