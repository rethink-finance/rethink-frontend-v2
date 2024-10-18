import { useFundsStore } from "../funds.store";

export async function calculateFundsPerformanceMetricsAction(
): Promise<any> {
  const fundsStore = await useFundsStore();

  try {
    if (!Array.isArray(fundsStore.funds)) {
      console.error("Error: this.funds is not an array");
      return;
    }
    for (const fund of fundsStore.funds) {
      try {
        const fundNAVUpdates = fundsStore.fundNAVUpdates[fund.address];
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
    }
  } catch (error) {
    console.error("Error fetching fund NAV updates: ", error);
  }
}