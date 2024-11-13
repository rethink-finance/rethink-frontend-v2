import { useFundStore } from "../fund.store";

export const fetchUserFundDataAction = async (
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();
  const rethinkReaderContract = fundStore.rethinkReaderContract;
  const activeAccountAddress = fundStore.activeAccountAddress;
  if (!activeAccountAddress || !rethinkReaderContract) return;

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
  // TODO fundDelegateAddress has a bug if the governanceToken is different than the fundToken.
  //  if that's true, just manually fetch the delegate here instead of taking it from the reader, and remove this
  //  quickfix when it is changed in the reader contract to take the correct one
  if (fundStore.fund?.address !== fundStore.fund?.governanceToken.address) {
    fundStore.fundUserData.fundDelegateAddress = await fundStore.callWithRetry(
      () =>
        fundStore.fundGovernanceTokenContract.methods
          .delegates(fundStore.activeAccountAddress)
          .call(),
    );
  } else {
    fundStore.fundUserData.fundDelegateAddress = fundDelegateAddress;
  }

  fundStore.fundUserData.baseTokenBalance = BigInt(baseTokenBalance);
  fundStore.fundUserData.fundTokenBalance = BigInt(fundTokenBalance);
  fundStore.fundUserData.governanceTokenBalance = BigInt(
    governanceTokenBalance,
  );
  fundStore.fundUserData.fundAllowance = BigInt(fundAllowance);
  fundStore.fundUserData.fundShareValue = BigInt(fundShareValue);
};
