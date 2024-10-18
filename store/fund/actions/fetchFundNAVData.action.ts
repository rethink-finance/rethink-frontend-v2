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

    fundStore.fund.totalNAVWei = fundNAVData.totalNav || 0n;

    fundStore.fund.positionTypeCounts =
      fundStore.parseFundPositionTypeCounts(fundNAVData);

    fundStore.fund.navUpdates = await fundStore.parseFundNAVUpdates(
      fundNAVData,
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
