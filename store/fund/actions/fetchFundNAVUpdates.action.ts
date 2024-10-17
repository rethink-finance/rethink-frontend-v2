import { useFundStore } from "../fund.store";

export const fetchFundNAVUpdatesAction = async (): Promise<any> => {
  const fundStore = useFundStore();

  if (!fundStore.fund) return;
  try {
    const dataNAV = await fundStore.callWithRetry(() =>
      fundStore.rethinkReaderContract.methods
        .getNAVDataForFund(fundStore.fund?.address)
        .call(),
    );
    console.log("fund NAV: ", dataNAV);
    fundStore.fund.positionTypeCounts =
      fundStore.parseFundPositionTypeCounts(dataNAV);
    fundStore.fund.navUpdates = await fundStore.parseFundNAVUpdates(
      dataNAV,
      fundStore.fund.address,
      fundStore.fundContract,
    );
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
