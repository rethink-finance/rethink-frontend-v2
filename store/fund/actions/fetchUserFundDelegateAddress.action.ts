import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserFundDelegateAddressAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();

  fundStore.fundUserData.fundDelegateAddress = "";
  if (!fundStore.fund?.governanceToken?.address) {
    console.log("Fund governanceToken.address is not set.");
    return;
  }
  if (!accountStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  console.warn("FETCH userFundDelegateAddress");

  fundStore.fundUserData.fundDelegateAddress =
    await fundStore.fundGovernanceTokenContract.methods
      .delegates(accountStore.activeAccountAddress)
      .call();
  console.warn(
    "FETCH userFundDelegateAddress",
    fundStore.fundUserData.fundDelegateAddress,
  );

  return fundStore.fundUserData.fundDelegateAddress;
};
