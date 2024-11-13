import { excludedFundAddresses } from "../config/excludedFundAddresses.config";
import { useFundsStore } from "../funds.store";
import { chainIds } from "~/store/web3/networksMap";
// You can see test funds by storing:
// excludeTestFunds: false
// to local storage.
const excludeTestFunds = getLocalStorageItem("excludeTestFunds", true);

export async function fetchFundsAction(): Promise<void> {
  const fundsStore = useFundsStore();

  // Loop through all available chains
  for (const chainId of chainIds) {
    // Reset the funds array for the current chain
    fundsStore.chainFunds[chainId] = [];

    // Fetch the funds info arrays
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(chainId);
    const fundAddresses: string[] = [];
    const filteredFundsInfoArrays: any[] = [[], []];
    const fundsInfo: Record<string, any> = {};

    // Filter out excluded test funds if necessary
    for (let i = 0; i < fundsInfoArrays[0].length; i++) {
      const fundAddress = fundsInfoArrays[0][i];
      const fundInfo = fundsInfoArrays[1][i];
      if (
        excludeTestFunds &&
        excludedFundAddresses[chainId]?.includes(fundAddress)
      ) {
        continue;
      }
      filteredFundsInfoArrays[0].push(fundAddress);
      filteredFundsInfoArrays[1].push(fundInfo);
      fundsInfo[fundAddress] = fundInfo;
      fundAddresses.push(fundAddress);
    }

    console.log(`Chain ${chainId} - Filtered Funds: `, filteredFundsInfoArrays);

    // Fetch metadata for the filtered funds
    const funds = await fundsStore.fetchFundsMetaData(
      chainId,
      fundAddresses,
      fundsInfo,
    );
    fundsStore.chainFunds[chainId] = funds;
    console.log(`Chain ${chainId} - Funds Metadata: `, funds);

    // Fetch NAV data for the filtered funds
    fundsStore.fetchFundsNAVData(chainId, filteredFundsInfoArrays).then(
      // Calculate performance metrics for the funds
      () => fundsStore.calculateFundsPerformanceMetrics(chainId),
    );

    console.log(`Funds fetched for chain: ${chainId}`);
  }
}
