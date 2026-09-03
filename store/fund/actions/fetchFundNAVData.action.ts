import { ERR_CONTRACT_EXECUTION_REVERTED } from "web3";
import { useFundStore } from "../fund.store";
import { NAVExecutor } from "assets/contracts/NAVExecutor";
import { decodeUpdateNavMethods } from "~/composables/nav/navProposal";
import { parseNAVMethod } from "~/composables/parseNavMethodDetails";
import { useWeb3Store } from "~/store/web3/web3.store";
import { excludeNAVUpdateIndexes } from "~/store/funds/config/excludedNAVUpdates.config";
import type { ChainId } from "~/types/enums/chain_id";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import type IFund from "~/types/fund";
import { fetchFundNavUpdatesAction, type ParsedNavUpdateDto, fetchFundDailyNavSnapshotsAction, type ParsedDailyNavSnapshotDto } from "~/store/funds/actions/fetchFundNavUpdates.action";
import { readCachedLastNavUpdate, writeCachedLastNavUpdate } from "~/store/funds/fundsCache";
import { patchCachedFundOverview } from "~/store/funds/fundOverviewCache";


export const fetchFundNAVDataAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const fund : IFund | undefined = fundStore.fund;

  if (!fund || !fund?.address) return;

  try {
    const navUpdatesPromise = fetchFundNAVDataWeb3(
      fund.chainId,
      fund.address,
    );
    const backendNavUpdatesPromise = fetchFundNavUpdatesAction(fund.chainId, fund.address);
    const backendDailyNavSnapshotsPromise = fetchFundDailyNavSnapshotsAction(fund.chainId, fund.address);

    // The reader call above takes seconds on a vault with a long history, and
    // the composition's simulation is waiting on the method list it carries.
    // Serve last session's final update meanwhile — the full fresh history
    // replaces it below, and a changed method list re-simulates on its own.
    if (!fund.navUpdates?.length) {
      const cachedLastUpdate = readCachedLastNavUpdate(
        fund.chainId,
        fund.address,
      );
      if (cachedLastUpdate) {
        fund.navUpdates = [cachedLastUpdate];
        fund.lastNAVUpdateTotalNAV =
          cachedLastUpdate.totalNAV ?? fund.lastNAVUpdateTotalNAV;
      }
    }

    let navUpdates = await navUpdatesPromise;
    // console.log("FUND NAV DATA", navUpdates);

    // Filter out NAV updates if their index is in the excludeNAVUpdateIndexes for that fund
    const excludedIndexes = excludeNAVUpdateIndexes[(fund.chainId as ChainId)]?.[fund.address] || [];
    navUpdates = excludedIndexes.length
      ? navUpdates.filter((navUpdate: INAVUpdate) => !excludedIndexes.includes(navUpdate.index))
      : navUpdates;

    // Simulated values live on the method objects themselves, and any earlier
    // round — one run against the cache-hydrated methods — wrote them there.
    // Replacing the arrays would throw that work away and an identical method
    // list would not re-simulate, so the values are carried across by
    // detailsHash before each swap. Collected at carry time: a round may
    // still be writing onto the old objects while the fresh read is awaited.
    const simulatedByHash = (entries: INAVMethod[]) =>
      new Map(
        entries
          .filter((entry: INAVMethod) => entry.detailsHash && entry.simulatedNav != null)
          .map((entry: INAVMethod) => [entry.detailsHash, entry]),
      );
    const carrySimulatedValues = (target: INAVMethod[], sources: INAVMethod[]) => {
      const previousEntries = simulatedByHash(sources);
      if (!previousEntries.size) return;
      for (const entry of target) {
        const previous = previousEntries.get(entry.detailsHash);
        if (!previous || entry.simulatedNav != null) continue;
        entry.simulatedNav = previous.simulatedNav;
        entry.simulatedNavFormatted = previous.simulatedNavFormatted;
        entry.isSimulatedNavError = previous.isSimulatedNavError;
        entry.pastNAVUpdateEntryFundAddress = previous.pastNAVUpdateEntryFundAddress;
        entry.foundMatchingPastNAVUpdateEntryFundAddress =
          previous.foundMatchingPastNAVUpdateEntryFundAddress;
      }
    };
    const hydratedEntries = (fund.navUpdates ?? []).flatMap(
      (update: INAVUpdate) => update.entries ?? [],
    );

    if (!navUpdates.length) {
      // No NAV updates yet, try fetching NAV methods directly.
      // This means that fund was freshly created and no NAV updates have been
      // made, but NAV methods were stored on fund create.
      // TODO ReaderContract should do this, return this if there are no updates!
      const previousInitialNavMethods = fundStore.fundInitialNAVMethods;
      const newNavMethods = await getNAVData(
        fund.chainId,
        fund.address,
      );
      // console.log("FETCHED GET NAV DATA", newNavMethods);

      fundStore.fundInitialNAVMethods = await mergeNAVMethodsFromLocalStorage(
        fundStore.selectedFundAddress,
        newNavMethods,
      );
      carrySimulatedValues(fundStore.fundInitialNAVMethods, [
        ...hydratedEntries,
        ...previousInitialNavMethods,
      ]);
      // A vault that has never settled draws its Composition from these.
      patchCachedFundOverview(fund.chainId, fund.address, {
        initialNavMethods: fundStore.fundInitialNAVMethods,
      });
      fundStore.fundManagedNAVMethods = fundStore.fundInitialNAVMethods;
      fundStore.refreshSimulateNAVCounter++;
    }
    const lastNavUpdate = navUpdates[navUpdates.length - 1];
    if (lastNavUpdate) {
      carrySimulatedValues(lastNavUpdate.entries ?? [], [
        ...hydratedEntries,
        ...fundStore.fundInitialNAVMethods,
      ]);
    }

    fund.lastNAVUpdateTotalNAV = navUpdates.length
      ? lastNavUpdate.totalNAV || 0n
      : fund.totalDepositBalance || 0n;
    fund.navUpdates = navUpdates;
    if (lastNavUpdate) {
      writeCachedLastNavUpdate(fund.chainId, fund.address, lastNavUpdate);
    }
    patchCachedFundOverview(fund.chainId, fund.address, { fund });

    backendNavUpdatesPromise
      .then((backendNavUpdates: ParsedNavUpdateDto[]) => {
        // console.log("backendNavUpdates", backendNavUpdates);
        const lastBackendNavUpdate = backendNavUpdates.find(
          (backendNavUpdate) => backendNavUpdate.index === lastNavUpdate.index,
        );
        fund.lastNAVUpdateTotalSupply = lastBackendNavUpdate?.totalSupply;
        fund.backendNavUpdates = backendNavUpdates;
        patchCachedFundOverview(fund.chainId, fund.address, { backendNavUpdates });
      })
      .catch((error: any) =>
        console.error("Failed fetching backendNavUpdatesPromise", error),
      );
    backendDailyNavSnapshotsPromise
      .then((backendDailyNavSnapshots: ParsedDailyNavSnapshotDto[]) => {
        // console.log("backendDailyNavSnapshots", backendDailyNavSnapshots);
        fund.backendDailyNavSnapshots = backendDailyNavSnapshots;
        patchCachedFundOverview(fund.chainId, fund.address, {
          backendDailyNavSnapshots,
        });
      })
      .catch((error: any) =>
        console.error("Failed fetching backendDailyNavSnapshotsPromise", error),
      );
  } catch (error) {
    console.error(
      "Error calling getNAVDataForFund: ",
      error,
      "fund: ",
      fund?.address,
    );
  }

  // Set last NAV update NAV methods to be editable/managed.
  const lastNavUpdateMethods = JSON.parse(
    JSON.stringify(fundStore.fundLastNAVUpdateMethods, stringifyBigInt),
    parseBigInt,
  );

  // Merge user's local storage NAV method changes with the last NAV update methods.
  fundStore.fundManagedNAVMethods = await mergeNAVMethodsFromLocalStorage(
    fundStore.selectedFundAddress,
    lastNavUpdateMethods,
  );
  fundStore.refreshSimulateNAVCounter++;
};

const fetchFundNAVDataWeb3 = async (fundChainId: ChainId, fundAddress: string): Promise<INAVUpdate[]> => {
  const fundStore = useFundStore();
  const web3Store = useWeb3Store();

  const rethinkReaderContract =
    web3Store.chainContracts[fundChainId]?.rethinkReaderContract;

  const fundNAVData = await web3Store.callWithRetry(
    fundChainId,
    () =>
      rethinkReaderContract.methods
        .getFundNAVData(fundAddress)
        .call(),
  );

  return await fundStore.parseFundNAVUpdates(
    fundChainId,
    fundNAVData,
    fundStore.selectedFundAddress,
  );
}
/**
 * This function calls getNAVData directly to NAV executor contract.
 **/
export const getNAVData = async (
  fundChainId: ChainId,
  fundAddress: string,
): Promise<INAVMethod[]> => {
  const web3Store = useWeb3Store();
  const navMethods: INAVMethod[] = [];
  console.debug("getNAVData", fundChainId, fundAddress);
  const { getNAVExecutorBeaconProxyAddress } = useContractAddresses();
  const navExecutorAddress = getNAVExecutorBeaconProxyAddress(fundChainId);
  if (!fundAddress) return navMethods;

  try {
    const navExecutorContract = web3Store.getCustomContract(
      fundChainId,
      NAVExecutor.abi,
      navExecutorAddress,
    );

    const updateNavDataEncoded: string = await web3Store.callWithRetry(
      fundChainId,
      () =>
        navExecutorContract.methods.getNAVData(fundAddress).call(),
      1,
      [310],
    );

    // Decode NAV methods.
    const updateNavDataDecoded = decodeUpdateNavMethods(updateNavDataEncoded);

    // Parse NAV methods.
    for (const [navMethodIndex, navMethod] of updateNavDataDecoded.navUpdateData.entries()) {
      const parsedNavMethod = parseNAVMethod(navMethodIndex, navMethod);
      navMethods.push(parsedNavMethod);
    }
  } catch (error: any) {
    // If execution was reverted, is probably because methods don't exist and
    // there is a require in contract "null output data". Could also check
    // if error.cause includes the "null output data", just to be sure.
    if (error.code !== ERR_CONTRACT_EXECUTION_REVERTED) {
      console.error("Failed loading NAV methods data from getNAVData.", error);
      throw error;
    }
  }
  console.debug("getNAVData parsed NAV methods", fundChainId, fundAddress, navMethods);
  return navMethods;
}

const mergeNAVMethodsFromLocalStorage = async (
  fundAddress: string,
  lastNavUpdateMethods: INAVMethod[],
) => {
  // TODO should do cached in local storage separately by chain: navUpdateEntries[chainId][fundAddress]
  // TODO: this code is not the best, generally now only "deleted" property can change for each NAV method,
  //   and they way mutation happen here is not good, losing reactive references?
  const localStorageNAVUpdateEntries = await getLocalForageItem("navUpdateEntries");
  // if there are no NAV methods in local storage, save them

  if (!localStorageNAVUpdateEntries[fundAddress]?.length) {
    // Merge NAV method changes from localStorage to the current fundManagedNAVMethods.
    localStorageNAVUpdateEntries[fundAddress] = lastNavUpdateMethods;
    setLocalForageItem("navUpdateEntries", localStorageNAVUpdateEntries);
  }
  const localStorageNAVMethods =
    localStorageNAVUpdateEntries[fundAddress] || [];
  // Create a Map using `detailsHash` as the key for the current fundManagedNAVMethods
  const navMap = new Map(
    lastNavUpdateMethods.map((item) => [item.detailsHash, item]),
  );

  // Merge localStorageNAVMethods, overwriting entries in navMap if `detailsHash` matches
  localStorageNAVMethods.forEach((localStorageNavMethod: INAVMethod) => {
    // If the NAV method from local storage was not present in the last NAV update methods, set isNew to true.
    localStorageNavMethod.isNew = !navMap.has(
      localStorageNavMethod.detailsHash,
    );
    // Prioritize localStorage entry if `detailsHash` matches
    navMap.set(localStorageNavMethod.detailsHash, localStorageNavMethod);
  });

  // Convert the merged Map back to an array.
  return Array.from(navMap.values());
};
