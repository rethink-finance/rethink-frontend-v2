import { useFundStore } from "../fund.store";
import type { ChainId } from "~/store/web3/networksMap";

export const fetchFundDataAction = async (
  fundChainId: ChainId,
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
