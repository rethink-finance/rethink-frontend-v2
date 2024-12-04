import { useFundsStore } from "../funds.store";

export async function calculateFundsPerformanceMetricsAction(
  chainId: string,
): Promise<any> {
  const fundsStore = useFundsStore();
  console.log("start calculateFundsPerformanceMetricsAction ", chainId);

  try {
    for (const fund of fundsStore.chainFunds[chainId]) {
      try {
        const fundNAVUpdates =
          fundsStore.chainFundNAVUpdates[fund.chainId][fund.address];
        const fundLastNavUpdate = fundNAVUpdates[fundNAVUpdates?.length - 1];
        const fundLastNavUpdateExists = fundLastNavUpdate?.timestamp;

        if (fund) {
          const baseTokenDecimals = fund.baseToken.decimals;
          const cumulativeReturnPercent = fundLastNavUpdateExists
            ? await calculateCumulativeReturnPercent(
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
    }
  } catch (error) {
    console.error("Error fetching fund NAV updates: ", error);
  }
}
