import { useFundStore } from "../fund.store";

export const fetchUserGovernanceTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.userBalances.governanceTokenBalance = BigInt("0");

  if (!fundStore.fund?.governanceToken?.address) {
    console.log("Fund governanceToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.userBalances.governanceTokenBalance = await fundStore.callWithRetry(
    () =>
      fundStore.fundGovernanceTokenContract.methods
        .balanceOf(fundStore.activeAccountAddress)
        .call(),
  );

  console.log(
    `user governance token balance is ${fundStore.userBalances.governanceTokenBalance} ${fundStore.fund?.fundToken?.symbol}`,
  );
  return fundStore.userBalances.governanceTokenBalance;
};
