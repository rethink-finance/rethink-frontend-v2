import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();

  fundStore.fundUserData.fundTokenBalance = BigInt("0");

  if (!fundStore.fund?.fundToken?.address) {
    console.log("Fund fundToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.fundUserData.fundTokenBalance = await web3Store.callWithRetry(
    fundStore.fundChainId,
    () =>
      fundStore.fundContract.methods
        .balanceOf(fundStore.activeAccountAddress)
        .call(),
  );

  console.log(
    `user fund token balance of ${fundStore.fund?.fundToken?.symbol} is ${fundStore.fundUserData.fundTokenBalance}`,
  );
  return fundStore.fundUserData.fundTokenBalance;
};
