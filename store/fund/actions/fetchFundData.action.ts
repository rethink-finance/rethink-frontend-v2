import { useFundStore } from "../fund.store";

import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";

export const fetchFundDataAction = async (
  fundAddress: string,
): Promise<IFund> => {
  const fundStore = useFundStore();

  fundStore.selectedFundAddress = fundAddress;
  fundStore.fund = undefined;
  fundStore.fundManagedNAVMethods = [];

  try {
    const [settingsData, performancePeriod, managementPeriod] =
      await Promise.all([
        fundStore.callWithRetry(() =>
          fundStore.fundContract.methods.getFundSettings().call(),
        ),
        fundStore.callWithRetry(() =>
          fundStore.fundContract.methods.feePerformancePeriod().call(),
        ),
        fundStore.callWithRetry(() =>
          fundStore.fundContract.methods.feeManagePeriod().call(),
        ),
      ]);

    settingsData.performancePeriod = performancePeriod;
    settingsData.managementPeriod = managementPeriod;

    const fundSettings: IFundSettings =
      fundStore.parseFundSettings(settingsData);
    const fund: IFund = await fundStore.fetchFundMetadata(fundSettings);

    fundStore.fund = fund;
    fundStore.fetchFundNAVUpdates();
    fundStore.fetchUserBalances();
    fundStore.fetchFundPendingDepositRedemptionBalance();
    return fund;
  } catch (e) {
    console.error(`Failed fetching fund data for ${fundAddress}`, e);
    throw e;
  }
};
