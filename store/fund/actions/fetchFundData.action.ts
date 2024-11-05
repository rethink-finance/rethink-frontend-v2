import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";

export const fetchFundDataAction = async (
  fundAddress: string,
): Promise<IFund> => {
  const fundStore = useFundStore();

  fundStore.resetFundData();
  fundStore.selectedFundAddress = fundAddress;

  try {
    const fund: IFund = await fundStore.fetchFundMetaData(fundAddress);

    await fundStore.fetchFundNAVData();

    fundStore.calculateFundPerformanceMetrics();
    fundStore.fetchUserFundData(fundAddress);

    fundStore.fetchFundPendingDepositRedemptionBalance();
    fundStore.fetchUserFundDepositRedemptionRequests();

    return fund;
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};
