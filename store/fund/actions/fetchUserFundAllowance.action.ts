import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";

export const fetchUserFundAllowanceAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();

  fundStore.fundUserData.fundAllowance = BigInt("0");
  if (!fundStore.fund?.baseToken?.address) {
    console.log("Fund baseToken.address is not set.");
    return;
  }
  if (!accountStore.activeAccountAddress)
    return console.error("Active account not found");

  fundStore.fundUserData.fundAllowance = await fundStore.callWithRetry(() =>
    fundStore.fundBaseTokenContract.methods
      .allowance(
        accountStore.activeAccountAddress,
        fundStore.selectedFundAddress,
      )
      .call(),
  );

  console.log(
    `user fund allowance of ${fundStore.fund?.baseToken?.symbol} is ${fundStore.fundUserData.fundAllowance}`,
  );
  return fundStore.fundUserData.fundAllowance;
};
