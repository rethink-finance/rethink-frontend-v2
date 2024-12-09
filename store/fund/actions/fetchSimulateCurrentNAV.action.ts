import { useAccountStore } from "~/store/account/account.store";
import { useFundsStore } from "~/store/funds/funds.store";
import { useWeb3Store } from "~/store/web3/web3.store";
import { useFundStore } from "../fund.store";

export const fetchSimulateCurrentNAVAction = async (
  fundChainId: string,
  fundAddress: string,
): Promise<void> => {
  const fundStore = useFundStore();
  const fundsStore = useFundsStore();
  const web3Store = useWeb3Store();
  const accountStore = useAccountStore();

  if (!fundsStore.allNavMethods?.length) {
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(fundChainId);

    // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
    // and make sure it is fetched before checking here with fundsStore.fetchFundsNavMethods, and then we
    // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
    console.log("[CURRENT NAV] simulate fetch all nav methods");
    await fundsStore.fetchFundsNavMethods(fundChainId, fundsInfoArrays);
  }
  console.log("[CURRENT NAV] START SIMULATE:");

  // Simulate all at once as many promises instead of one by one.
  const promises = [];

  for (const navEntry of fundStore.fundLastNAVUpdateMethods) {
    promises.push(
      accountStore.requestConcurrencyLimit(() =>
        web3Store.callWithRetry(
          fundChainId,
          () => fundStore.fetchSimulatedNAVMethodValue(fundChainId, fundAddress, navEntry),
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
