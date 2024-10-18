import { useFundStore } from "../fund.store";


export async function calculateFundPerformanceMetricsAction(): Promise<any> {
  const fundStore = await useFundStore();

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
          ? await calculateCumulativeReturnPercent(
            fund.totalDepositBalance,
            fund.totalNAVWei || 0n,
            baseTokenDecimals,
          )
          : 0;

        fund.totalNAVWei = fundLastNavUpdateExists
          ? fund.totalNAVWei
          : fund.totalDepositBalance;
        fund.cumulativeReturnPercent = cumulativeReturnPercent;
        fund.navUpdates = fundNAVUpdates;
        fund.isNavUpdatesLoading = false;
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
