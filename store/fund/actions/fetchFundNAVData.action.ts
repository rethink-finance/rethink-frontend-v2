import { useFundStore } from "../fund.store";
import { parseNavMethodsPositionTypeCounts } from "~/composables/nav/parseNavMethodsPositionTypeCounts";
import type INAVMethod from "~/types/nav_method";

export const fetchFundNAVDataAction = async (): Promise<any> => {
  const fundStore = useFundStore();
  const fund = fundStore.fund;

  if (!fund?.address) return;

  try {
    const fundNAVData = await fundStore.callWithRetry(() =>
      fundStore.rethinkReaderContract.methods
        .getFundNAVData(fund?.address)
        .call(),
    );

    const navUpdates = await fundStore.parseFundNAVUpdates(
      fundNAVData,
      fundStore.selectedFundAddress,
    );
    const lastNavUpdate = navUpdates[navUpdates.length - 1];

    fund.positionTypeCounts = parseNavMethodsPositionTypeCounts(lastNavUpdate?.entries);

    fund.lastNAVUpdateTotalNAV = navUpdates.length
      ? lastNavUpdate.totalNAV || 0n
      : fund.totalDepositBalance || 0n;
    fund.navUpdates = navUpdates;

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
  console.log(
    "fundManagedNAVMethods: ",
    toRaw(fundStore.fundManagedNAVMethods),
  );

  // Merge user's local storage NAV method changes with the last NAV update methods.
  fundStore.fundManagedNAVMethods = mergeNAVMethodsFromLocalStorage(fundStore.selectedFundAddress, lastNavUpdateMethods);
  fundStore.refreshSimulateNAVCounter++;
};

const mergeNAVMethodsFromLocalStorage = (fundAddress: string, lastNavUpdateMethods: INAVMethod[]) => {
  // TODO should do cached in local storage separately by chain: navUpdateEntries[chainId][fundAddress]
  // TODO: this code is not the best, generally now only "deleted" property can change for each NAV method,
  //   and they way mutation happen here is not good, losing reactive references?
  const localStorageNAVUpdateEntries = getLocalStorageItem("navUpdateEntries");
  // if there are no NAV methods in local storage, save them

  if (!localStorageNAVUpdateEntries[fundAddress]?.length) {
    // Merge NAV method changes from localStorage to the current fundManagedNAVMethods.
    localStorageNAVUpdateEntries[fundAddress] = lastNavUpdateMethods;
    setLocalStorageItem("navUpdateEntries", localStorageNAVUpdateEntries);
  }
  const localStorageNAVMethods = localStorageNAVUpdateEntries[fundAddress] || [];
  // Create a Map using `detailsHash` as the key for the current fundManagedNAVMethods
  const navMap = new Map(lastNavUpdateMethods.map(item => [item.detailsHash, item]));

  // Merge localStorageNAVMethods, overwriting entries in navMap if `detailsHash` matches
  localStorageNAVMethods.forEach((localStorageNavMethod: INAVMethod) => {
    // If the NAV method from local storage was not present in the last NAV update methods, set isNew to true.
    localStorageNavMethod.isNew = !navMap.has(localStorageNavMethod.detailsHash);
    // Prioritize localStorage entry if `detailsHash` matches
    navMap.set(localStorageNavMethod.detailsHash, localStorageNavMethod);
  });

  // Convert the merged Map back to an array.
  return Array.from(navMap.values());
}
