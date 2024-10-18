import { useFundStore } from "../fund.store";

export const fetchUserFundDataAction = async (
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();
  const rethinkReaderContract = fundStore.rethinkReaderContract;
  const activeAccountAddress = fundStore.activeAccountAddress;
  if (!activeAccountAddress || !rethinkReaderContract) return;

  console.log("debug", fundAddress, activeAccountAddress);
  const results = await Promise.allSettled(
    [
      () =>
        rethinkReaderContract.methods
          .getFundUserData(fundAddress, activeAccountAddress)
          .call(),
    ].map((fn: () => Promise<any>) =>
      fundStore.accountStore.requestConcurrencyLimit(() =>
        fundStore.callWithRetry(fn),
      ),
    ),
  );

  const [fundUserData]: any[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    console.error("Failed fetching fund user data value for: ", index, result);
    return undefined;
  });

  const {
    baseTokenBalance,
    fundTokenBalance,
    governanceTokenBalance,
    fundAllowance,
    fundShareValue,
    fundDelegateAddress,
  } = fundUserData;

  fundStore.fundUserData.baseTokenBalance = BigInt(baseTokenBalance);
  fundStore.fundUserData.fundTokenBalance = BigInt(fundTokenBalance);
  fundStore.fundUserData.governanceTokenBalance = BigInt(
    governanceTokenBalance,
  );
  fundStore.fundUserData.fundAllowance = BigInt(fundAllowance);
  fundStore.fundUserData.fundShareValue = BigInt(fundShareValue);
  fundStore.fundUserData.fundDelegateAddress = fundDelegateAddress;
};
