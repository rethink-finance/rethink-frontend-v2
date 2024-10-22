import { excludedFundAddresses } from "../config/excludedFundAddresses.config";
import { useFundsStore } from "../funds.store";

export async function fetchFundsAction(excludeTestFunds: boolean): Promise<any> {
  const fundsStore = await useFundsStore();

  fundsStore.funds = [];

  const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays();
  const fundAddresses: string[] = [];
  const filteredFundsInfoArrays: any[] = [[], []];
  const fundsInfo: Record<string, any> = {};

  for (let i = 0; i < fundsInfoArrays[0].length; i++) {
    const fundAddress = fundsInfoArrays[0][i];
    const fundInfo = fundsInfoArrays[1][i];
    if (
      excludeTestFunds &&
      excludedFundAddresses[fundsStore.web3Store.chainId].includes(fundAddress)
    ) {
      continue;
    }
    filteredFundsInfoArrays[0].push(fundAddress);
    filteredFundsInfoArrays[1].push(fundInfo);
    fundsInfo[fundAddress] = fundInfo;
    fundAddresses.push(fundAddress);
  }
  console.log("fundsInfoArrays: ", toRaw(fundsInfoArrays));
  console.log("filteredFundsInfoArrays: ", filteredFundsInfoArrays);

  const funds = await fundsStore.fetchFundsMetaData(fundAddresses, fundsInfo);
  fundsStore.funds = funds;
  console.log("All Funds: ", funds);

  // Fetch all possible NAV methods for all funds.
  await fundsStore.fetchFundsNAVData(filteredFundsInfoArrays);

  // Calculate Fund Performance metrics like cumulative returns, sharpe ratio...
  fundsStore.calculateFundsPerformanceMetrics();
}
