import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";

export const fetchFundDataAction = async (
  fundAddress: string,
): Promise<IFund> => {
  const fundStore = useFundStore();

  fundStore.selectedFundAddress = fundAddress;
  fundStore.fund = undefined;
  fundStore.fundManagedNAVMethods = [];

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
