import { chainIds } from "~/store/web3/networksMap";
import { excludedFundAddresses } from "../config/excludedFundAddresses.config";
import { useFundsStore } from "../funds.store";
// You can see test funds by storing:
// excludeTestFunds: false
// to local storage.
const excludeTestFunds = getLocalStorageItem("excludeTestFunds", true);

export async function fetchFundsAction(): Promise<void> {
  const fundsStore = useFundsStore();

  // Function to process each chain asynchronously
  async function processChain(chainId: string): Promise<void> {
    // Fetch the funds info arrays
    let fundsInfoArrays = fundsStore.chainFundsInfoArrays[chainId];
    // Only fetch if there are no funds fetched yet.
    if (!fundsInfoArrays?.length) {
      fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(chainId);
    }
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

    console.debug(`Chain ${chainId} - Filtered Funds: `, filteredFundsInfoArrays);
    // Save chainFundsInfoArrays to fundsStore to prevent refetching later.
    fundsStore.chainFundsInfoArrays[chainId] = filteredFundsInfoArrays;

    // If data was fetched already just return and skip re-fetching again.
    if (fundsStore.chainFunds[chainId]?.length) {
      return
    }

    // Fetch metadata for the filtered funds
    const funds = await fundsStore.fetchFundsMetaData(
      chainId,
      fundAddresses,
      fundsInfo,
    );
    fundsStore.chainFunds[chainId] = funds;
    console.debug(`Chain ${chainId} - Funds Metadata: `, funds);

    // Fetch NAV data and calculate performance metrics
    await fundsStore.fetchFundsNavMethods(chainId, filteredFundsInfoArrays);
    await fundsStore.calculateFundsPerformanceMetrics(chainId);
    console.debug(`Funds fetched for chain: ${chainId}`);
  }

  // Process all chains simultaneously
  const chainPromises = chainIds.map((chainId) => processChain(chainId));

  // Wait for all chain promises to resolve
  await Promise.all(chainPromises);

  console.warn("ALL FUNDS FETCHED: ", fundsStore.chainFunds);
}
