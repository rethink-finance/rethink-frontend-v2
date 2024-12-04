import { useFundStore } from "../fund.store";

export const fetchFundDataAction = async (
  fundChainId: string,
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.resetFundData(fundChainId, fundAddress);
  fundStore.selectedFundChain = fundChainId;
  fundStore.selectedFundAddress = fundAddress;
  try {
    await fundStore.fetchFundMetaData(fundChainId, fundAddress);
    await fundStore.fetchFundNAVData();

    fundStore.calculateFundPerformanceMetrics();
    fundStore.fetchUserFundData(fundChainId, fundAddress);

    fundStore.fetchFundPendingDepositRedemptionBalance();
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};
