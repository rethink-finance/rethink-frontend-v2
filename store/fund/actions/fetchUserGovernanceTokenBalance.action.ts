import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserGovernanceTokenBalanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();

  fundStore.fundUserData.governanceTokenBalance = BigInt("0");

  if (!fundStore.fund?.governanceToken?.address) {
    console.log("Fund governanceToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress) {
    console.log("activeAccountAddress is not set.");
    return;
  }
  fundStore.fundUserData.governanceTokenBalance = await web3Store.callWithRetry(
    fundStore.fundChainId,
    () =>
      fundStore.fundGovernanceTokenContract.methods
        .balanceOf(fundStore.activeAccountAddress)
        .call(),
  );

  console.log(
    `user governance token balance is ${fundStore.fundUserData.governanceTokenBalance} ${fundStore.fund?.fundToken?.symbol}`,
  );
  return fundStore.fundUserData.governanceTokenBalance;
};
