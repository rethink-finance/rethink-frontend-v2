import { useFundsStore } from "../funds.store";
import { useFundStore } from "~/store/fund/fund.store";

export function calculateFundsPerformanceMetricsAction(
  chainId: string,
): any {
  const fundsStore = useFundsStore();
  const fundStore = useFundStore();
  console.log("start calculateFundsPerformanceMetricsAction ", chainId);

  for (const fund of fundsStore.chainFunds[chainId]) {
    fundStore.calculateFundPerformanceMetrics(fund);
  }
}
