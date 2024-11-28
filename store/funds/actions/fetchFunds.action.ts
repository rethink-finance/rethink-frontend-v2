import { excludedFundAddresses } from "../config/excludedFundAddresses.config";
import { useFundsStore } from "../funds.store";
import { chainIds } from "~/store/web3/networksMap";
// You can see test funds by storing:
// excludeTestFunds: false
// to local storage.
const excludeTestFunds = getLocalStorageItem("excludeTestFunds", true);

export async function fetchFundsAction(): Promise<void> {
  const fundsStore = useFundsStore();

  // Function to process each chain asynchronously
  async function processChain(chainId: string): Promise<void> {
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

    // Fetch NAV data and calculate performance metrics
    await fundsStore.fetchFundsNAVData(chainId, filteredFundsInfoArrays);
    await fundsStore.calculateFundsPerformanceMetrics(chainId);

    console.log(`Funds fetched for chain: ${chainId}`);
  }

  // Process all chains simultaneously
  const chainPromises = chainIds.map((chainId) => processChain(chainId));

  // Wait for all chain promises to resolve
  await Promise.all(chainPromises);

  console.warn("ALL FUNDS FETCHED: ", fundsStore.chainFunds);
}
