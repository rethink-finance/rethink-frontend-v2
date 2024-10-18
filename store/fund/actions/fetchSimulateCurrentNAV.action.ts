import { useFundStore } from "../fund.store";

export const fetchSimulateCurrentNAVAction = async (): Promise<void> => {
  const fundStore = useFundStore();

  if (!fundStore.web3Store.web3) return;

  if (!fundStore.fundsStore.allNavMethods?.length) {
    const fundsInfoArrays = await fundStore.fundsStore.fetchFundsInfoArrays();

    // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
    // and make sure it is fetched before checking here with fundsStore.fetchFundsNAVData, and then we
    // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
    console.log("[CURRENT NAV] simulate fetch all nav methods");
    await fundStore.fundsStore.fetchFundsNAVData(fundsInfoArrays);
  }
  console.log("[CURRENT NAV] START SIMULATE:");

  // Simulate all at once as many promises instead of one by one.
  const promises = [];

  for (const navEntry of fundStore.fundLastNAVUpdateMethods) {
    promises.push(
      fundStore.accountStore.requestConcurrencyLimit(() =>
        fundStore.callWithRetry(
          () => fundStore.fetchSimulatedNAVMethodValue(navEntry),
          1,
          // Do not retry internal errors (probably invalid NAV method), better to fail on 1st try.
          // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
          [-32603],
        ),
      ),
    );
  }
  await Promise.allSettled(promises);
};
