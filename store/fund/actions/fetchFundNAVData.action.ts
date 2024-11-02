import { useFundStore } from "../fund.store";

export const fetchFundNAVDataAction = async (): Promise<any> => {
  const fundStore = useFundStore();

  if (!fundStore.fund) return;

  try {
    const fundNAVData = await fundStore.callWithRetry(() =>
      fundStore.rethinkReaderContract.methods
        .getFundNAVData(fundStore.fund?.address)
        .call(),
    );

    // TODO this is wrong, should use position types from the last nav update after it is parsed in the next lines
    console.warn("NAV data", fundNAVData);
    const navUpdates = await fundStore.parseFundNAVUpdates(
      fundNAVData,
      fundStore.selectedFundAddress,
    );
    const lastNavUpdate = navUpdates[navUpdates.length - 1];
    console.warn("NAV data lastNavUpdate methods", lastNavUpdate?.entries);

    fundStore.fund.positionTypeCounts =
      fundStore.parseFundPositionTypeCounts(lastNavUpdate?.entries);
    console.warn("NAV data positionTypeCounts", fundStore.fund.positionTypeCounts);

    fundStore.fund.lastNAVUpdateTotalNAV = navUpdates.length
      ? lastNavUpdate.totalNAV || 0n
      : fundStore.fund.totalDepositBalance || 0n;
    fundStore.fund.navUpdates = navUpdates;

  } catch (error) {
    console.error(
      "Error calling getNAVDataForFund: ",
      error,
      "fund: ",
      fundStore.fund.address,
    );
  }

  fundStore.fundManagedNAVMethods = JSON.parse(
    JSON.stringify(fundStore.fundLastNAVUpdateMethods, stringifyBigInt),
    parseBigInt,
  );
  console.log(
    "fundManagedNAVMethods: ",
    toRaw(fundStore.fundManagedNAVMethods),
  );
  fundStore.mergeNAVMethodsFromLocalStorage();
};
