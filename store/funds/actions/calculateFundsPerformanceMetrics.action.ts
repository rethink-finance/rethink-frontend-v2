import { useFundsStore } from "../funds.store";
import { useFundStore } from "~/store/fund/fund.store";

export function calculateFundsPerformanceMetricsAction(
  chainId: string,
): any {
  const fundsStore = useFundsStore();
  const fundStore = useFundStore();
  console.log("start calculateFundsPerformanceMetricsAction ", chainId);

  try {
    for (const fund of fundsStore.chainFunds[chainId]) {
      try {
        fundStore.calculateFundPerformanceMetrics(fund);
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
