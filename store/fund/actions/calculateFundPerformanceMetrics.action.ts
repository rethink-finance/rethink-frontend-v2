import { useFundStore } from "../fund.store";


export async function calculateFundPerformanceMetricsAction(): Promise<any> {
  const fundStore = useFundStore();

  try {
    if (!fundStore.fund) {
      console.error("Error: this.fund is not available");
      return;
    }
    const fund = fundStore.fund;
    try {
      const fundNAVUpdates = fund.navUpdates;
      const fundLastNavUpdate = fundNAVUpdates[fundNAVUpdates?.length - 1];
      const fundLastNavUpdateExists = fundLastNavUpdate?.timestamp;

      if (fund) {
        const baseTokenDecimals = fund.baseToken.decimals;
        const cumulativeReturnPercent = fundLastNavUpdateExists
          ? calculateCumulativeReturnPercent(
            fund.totalDepositBalance,
            fund.lastNAVUpdateTotalNAV || 0n,
            baseTokenDecimals,
          )
          : 0;

        fund.lastNAVUpdateTotalNAV = fundLastNavUpdateExists
          ? fund.lastNAVUpdateTotalNAV
          : fund.totalDepositBalance;
        fund.cumulativeReturnPercent = cumulativeReturnPercent;
        fund.navUpdates = fundNAVUpdates;
        fund.isNavUpdatesLoading = false;
        fund.sharpeRatio = calculateSharpeRatio(fundNAVUpdates);
      }
    } catch (error) {
      console.error(
        "Error calculating fund performance metrics: ",
        fund,
        error,
      );
      fund.isNavUpdatesLoading = false;
    }
  } catch (error) {
    console.error("Error fetching fund NAV updates: ", error);
  }
}
