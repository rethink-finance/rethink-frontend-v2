import { excludedFundAddresses } from "../config/excludedFundAddresses.config";
import { useFundsStore } from "../funds.store";
import { readCachedChainFunds, writeCachedChainFunds } from "../fundsCache";
import { fetchFundsLatestSnapshotsAction } from "./fetchFundLatestSnapshot.action";
import { ChainId } from "~/types/enums/chain_id";
import { chainIds } from "~/store/web3/networksMap";
// You can see test funds by storing:
// excludeTestFunds: false
// to local storage.

export async function fetchFundsAction(): Promise<void> {
  const fundsStore = useFundsStore();

  // Paint the last known-good result straight away so the table has rows on
  // the first frame, then let the fetch below overwrite each chain as its
  // real data lands. Chains restored this way are tracked separately, so the
  // "already fetched, skip it" check further down does not mistake cached
  // rows for fresh ones and stop us revalidating.
  const cachedChainFunds = readCachedChainFunds();
  const chainsFromCache = new Set<string>();
  if (cachedChainFunds) {
    for (const [chainId, funds] of Object.entries(cachedChainFunds)) {
      if (!funds?.length) continue;
      fundsStore.chainFunds[chainId] = funds;
      chainsFromCache.add(chainId);
    }
  }

  // Fetch total TVL data
  fundsStore.fetchTotalTVL();

  // Function to process each chain asynchronously
  async function processChain(chainId?: ChainId): Promise<void> {
    if (!chainId) return;
    // if (chainId !== ChainId.ARBITRUM) return;

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
    // Cached rows do not count as fetched — they still need revalidating.
    if (fundsStore.chainFunds[chainId]?.length && !chainsFromCache.has(chainId)) {
      return
    }

    // Fetch metadata for the filtered funds
    const funds = await fundsStore.fetchFundsMetaData(
      chainId,
      fundAddresses,
      fundsInfo,
    );
    fundsStore.chainFunds[chainId] = funds;
    chainsFromCache.delete(chainId);

    // Fetch the latest snapshot for each fund to get current value
    // Make sure to load this data async, to not block the UI from at least loading fund names and metadata.
    fetchFundsLatestSnapshotsAction(funds).then(fundsWithCurrentValue => {
      fundsStore.chainFunds[chainId] = fundsWithCurrentValue;
      writeCachedChainFunds(fundsStore.chainFunds);
      console.debug(`Chain ${chainId} - Funds with Current Value: `, fundsWithCurrentValue);
    }).catch(async (error: any) => {
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
    });

    console.debug(`Funds fetched for chain: ${chainId}`);
  }

  // The local hardhat chain is in networksMap during development, but almost
  // nobody has a node on :8545 while doing frontend work. Left in, every
  // discover load spends ~15s timing out against it and fills the console
  // with RPC errors. Opt back in with:
  //   localStorage.setItem("includeLocalNode", "true")
  const discoverChainIds = chainIds.filter(
    (chainId) =>
      chainId !== ChainId.LOCAL_NODE ||
      localStorage.getItem("includeLocalNode") === "true",
  );

  // Process all chains simultaneously
  const chainPromises = discoverChainIds.map((chainId) => processChain(chainId));

  // Wait for all chain promises to resolve
  await Promise.allSettled(chainPromises);

  // Anything still flagged here is a chain whose fetch threw before it got
  // as far as metadata (RPC down, usually). Its cached rows stay on screen —
  // day-old numbers beat a blank table, and the cache TTL bounds how stale
  // they can get. A chain that responds with no funds clears itself above.
  if (chainsFromCache.size) {
    console.warn("Serving cached funds for chains that failed to refresh: ", [
      ...chainsFromCache,
    ]);
  }
  writeCachedChainFunds(fundsStore.chainFunds);

  console.warn("ALL FUNDS FETCHED: ", fundsStore.chainFunds);
}
