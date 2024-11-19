import { useFundStore } from "../fund.store";

export const fetchFundDataAction = async (
  fundChainId: string,
  fundAddress: string,
): Promise<any> => {
  const fundStore = useFundStore();

  fundStore.resetFundData(fundChainId, fundAddress);
  fundStore.selectedFundChain = fundChainId;
  fundStore.selectedFundAddress = fundAddress;
  console.log("fund1");
  try {
    await fundStore.fetchFundMetaData(fundChainId, fundAddress);
    console.log("fund2");
    await fundStore.fetchFundNAVData();
    console.log("fund3");

    fundStore.calculateFundPerformanceMetrics();
    console.log("fund4");
    fundStore.fetchUserFundData(fundChainId, fundAddress);
    console.log("fund5");

    fundStore.fetchFundPendingDepositRedemptionBalance();
    console.log("fund6");
    fundStore.fetchUserFundDepositRedemptionRequests();
    console.log("fund7");
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};
