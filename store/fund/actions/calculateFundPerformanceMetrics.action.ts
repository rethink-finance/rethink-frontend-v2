import type IFund from "~/types/fund";


export function calculateFundPerformanceMetricsAction(
  fund: IFund | undefined,
): any {
  if (!fund) {
    console.error("Error: this.fund is not available");
    return;
  }

  try {
    const fundNAVUpdates = fund.navUpdates;
    const fundLastNavUpdate = fundNAVUpdates[fundNAVUpdates?.length - 1];
    const fundLastNavUpdateExists = fundLastNavUpdate?.timestamp;
    console.warn("METRICS title", fund.title)
    console.warn("METRICS totalDepositBalance", fund.totalDepositBalance)
    console.warn("METRICS last NAV update", fundLastNavUpdate)

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
      fund.isNavUpdatesLoading = false;
      fund.sharpeRatio = calculateSharpeRatio(fundNAVUpdates, fund.totalDepositBalance);
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
