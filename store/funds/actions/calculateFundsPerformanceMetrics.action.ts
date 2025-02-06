import { useFundsStore } from "../funds.store";
import { useFundStore } from "~/store/fund/fund.store";
import { type ChainId } from "~/store/web3/networksMap";

export function calculateFundsPerformanceMetricsAction(
  chainId: ChainId,
): any {
  const fundsStore = useFundsStore();
  const fundStore = useFundStore();
  console.log("start calculateFundsPerformanceMetricsAction ", chainId);

  for (const fund of fundsStore.chainFunds[chainId]) {
    fundStore.calculateFundPerformanceMetrics(fund);
  }
}
