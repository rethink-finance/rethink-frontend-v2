import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserFundTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();

  fundStore.fundUserData.fundTokenBalance = BigInt("0");

  if (!fundStore.fund?.fundToken?.address) {
    console.log("Fund fundToken.address is not set.");
    return;
  }
  if (!accountStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.fundUserData.fundTokenBalance = await fundStore.fundContract.methods
    .balanceOf(accountStore.activeAccountAddress)
    .call();

  console.log(
    `user fund token balance of ${fundStore.fund?.fundToken?.symbol} is ${fundStore.fundUserData.fundTokenBalance}`,
  );
  return fundStore.fundUserData.fundTokenBalance;
};
