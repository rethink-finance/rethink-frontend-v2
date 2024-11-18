import { useFundStore } from "../fund.store";

export const fetchUserBaseTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  fundStore.fundUserData.baseTokenBalance = BigInt("0");

  if (!fundStore.fund?.baseToken?.address) {
    console.log("Fund baseToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.fundUserData.baseTokenBalance =
    await fundStore.fundBaseTokenContract.methods
      .balanceOf(fundStore.activeAccountAddress)
      .call();

  console.log(
    `user base token balance of ${fundStore.fund?.baseToken?.symbol} is ${fundStore.fundUserData.baseTokenBalance}`,
  );
  return fundStore.fundUserData.baseTokenBalance;
};
