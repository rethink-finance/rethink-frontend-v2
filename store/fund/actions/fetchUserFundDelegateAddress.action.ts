import { useFundStore } from "../fund.store";

export const fetchUserFundDelegateAddressAction = async (): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.userFundDelegateAddress = "";
  if (!fundStore.fund?.governanceToken?.address) {
    console.log("Fund governanceToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  console.warn("FETCH userFundDelegateAddress");

  fundStore.userFundDelegateAddress = await fundStore.callWithRetry(() =>
    fundStore.fundContract.methods
      .delegates(fundStore.activeAccountAddress)
      .call(),
  );
  console.warn(
    "FETCH userFundDelegateAddress",
    fundStore.userFundDelegateAddress,
  );

  return fundStore.userFundDelegateAddress;
};
