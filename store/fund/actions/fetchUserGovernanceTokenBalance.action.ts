import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserGovernanceTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();

  fundStore.fundUserData.governanceTokenBalance = BigInt("0");

  if (!fundStore.fund?.governanceToken?.address) {
    console.log("Fund governanceToken.address is not set.");
    return;
  }
  if (!accountStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.fundUserData.governanceTokenBalance =
    await fundStore.fundGovernanceTokenContract.methods
      .balanceOf(accountStore.activeAccountAddress)
      .call();

  console.log(
    `user governance token balance is ${fundStore.fundUserData.governanceTokenBalance} ${fundStore.fund?.fundToken?.symbol}`,
  );
  return fundStore.fundUserData.governanceTokenBalance;
};
