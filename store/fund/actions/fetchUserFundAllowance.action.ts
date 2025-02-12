import { useFundStore } from "../fund.store";
import { useWeb3Store } from "~/store/web3/web3.store";

export const fetchUserFundAllowanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();

  fundStore.fundUserData.fundAllowance = BigInt("0");
  if (!fundStore.fund?.baseToken?.address) {
    console.log("Fund baseToken.address is not set.");
    return;
  }
  if (!fundStore.activeAccountAddress)
    return console.error("Active account not found");

  fundStore.fundUserData.fundAllowance = await web3Store.callWithRetry(
    fundStore.selectedFundChain,
    () =>
      fundStore.fundBaseTokenContract.methods
        .allowance(fundStore.activeAccountAddress, fundStore.selectedFundAddress)
        .call(),
  );

  console.log(
    `user fund allowance of ${fundStore.fund?.baseToken?.symbol} is ${fundStore.fundUserData.fundAllowance}`,
  );
  return fundStore.fundUserData.fundAllowance;
};
