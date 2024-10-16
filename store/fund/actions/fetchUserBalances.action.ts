import { useFundStore } from "../fund.store";

export const fetchUserBalancesAction = async (
): Promise<any> => {
  const fundStore = useFundStore();

  if (
    !fundStore.activeAccountAddress ||
    !fundStore.fund?.fundToken?.address ||
    !fundStore.fund?.baseToken?.address ||
    !fundStore.fund?.governanceToken?.address ||
    !fundStore.fund?.address
  )
    return;
  fundStore.loadingUserBalances = true;

  const promises = await Promise.allSettled(
    [
      () => fundStore.fetchUserBaseTokenBalance(),
      () => fundStore.fetchUserFundTokenBalance(),
      () => fundStore.fetchUserGovernanceTokenBalance(),
      () => fundStore.fetchUserFundDelegateAddress(),
      () => fundStore.fetchUserFundShareValue(),
      () => fundStore.fetchUserFundAllowance(),
      () => fundStore.fetchUserFundDepositRedemptionRequests(),
    ].map((fn: () => Promise<any>) =>
      fundStore.accountStore.requestConcurrencyLimit(fn),
    ),
  );

  fundStore.loadingUserBalances = false;
  return promises;
};
