import { useFundStore } from "../fund.store";

export const fetchFundDataAction = async (
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.resetFundData();
  fundStore.selectedFundAddress = fundAddress;

  try {
    await fundStore.fetchFundMetaData(fundAddress);
    await fundStore.fetchFundNAVData();

    fundStore.calculateFundPerformanceMetrics();
    fundStore.fetchUserFundData(fundAddress);

    fundStore.fetchFundPendingDepositRedemptionBalance();
    fundStore.fetchUserFundDepositRedemptionRequests();
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};
