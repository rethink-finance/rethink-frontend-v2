import { excludedFundAddresses } from "../config/excludedFundAddresses.config";
import { useFundsStore } from "../funds.store";
import { fetchFundsLatestSnapshotsAction } from "./fetchFundLatestSnapshot.action";
import { ChainId } from "~/types/enums/chain_id";
import { chainIds } from "~/store/web3/networksMap";
// You can see test funds by storing:
// excludeTestFunds: false
// to local storage.

export async function fetchFundsAction(): Promise<void> {
  const fundsStore = useFundsStore();

  // Function to process each chain asynchronously
  async function processChain(chainId?: ChainId): Promise<void> {
    if (!chainId) return;

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
      if (excludedFundAddresses[chainId]?.includes(fundAddress.toLowerCase())) {
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

    // Fetch the latest snapshot for each fund to get current value
    try {
      const fundsWithCurrentValue = await fetchFundsLatestSnapshotsAction(funds);
      fundsStore.chainFunds[chainId] = fundsWithCurrentValue;
      console.debug(`Chain ${chainId} - Funds with Current Value: `, fundsWithCurrentValue);
    } catch (error: any) {
      console.error("Failed to fetch latest snapshots", chainId, error);
      fundsStore.chainFunds[chainId] = funds;
      console.debug(`Chain ${chainId} - Funds Metadata (without Current Value): `, funds);

      // BACKUP if backend data is not available, query chain
      // Fetch NAV data and calculate performance metrics
      try {
        // Pass storeAllMethods: false as we don't want to save methods to all methods as they
        // are not all there, because we pass filtered addresses instead of all addresses.
        await fundsStore.fetchFundsNavMethods(chainId, filteredFundsInfoArrays, false);
      } catch (error: any) {
        console.error("Failed fetchFundsNavMethods", chainId, filteredFundsInfoArrays, error);
        return
      }
      try {
        await fundsStore.calculateFundsPerformanceMetrics(chainId);
      } catch (error: any) {
        console.error("Failed calculateFundsPerformanceMetrics", chainId, error);
      }
    }

    console.debug(`Funds fetched for chain: ${chainId}`);
  }

  // Process all chains simultaneously
  const chainPromises = chainIds.map((chainId) => processChain(chainId));

  // Wait for all chain promises to resolve
  await Promise.allSettled(chainPromises);

  console.warn("ALL FUNDS FETCHED: ", fundsStore.chainFunds);
}
