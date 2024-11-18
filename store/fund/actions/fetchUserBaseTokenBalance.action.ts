import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserBaseTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();
  fundStore.fundUserData.baseTokenBalance = BigInt("0");

  if (!fundStore.fund?.baseToken?.address) {
    console.log("Fund baseToken.address is not set.");
    return;
  }
  if (!accountStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.fundUserData.baseTokenBalance =
    await fundStore.fundBaseTokenContract.methods
      .balanceOf(accountStore.activeAccountAddress)
      .call();

  console.log(
    `user base token balance of ${fundStore.fund?.baseToken?.symbol} is ${fundStore.fundUserData.baseTokenBalance}`,
  );
  return fundStore.fundUserData.baseTokenBalance;
};
