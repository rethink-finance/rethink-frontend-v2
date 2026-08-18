import { useFundStore } from "../fund.store";
import { useAccountStore } from "~/store/account/account.store";
import { useFundsStore } from "~/store/funds/funds.store";
import {
  readCachedNavEntryMap,
  writeCachedNavEntryMap,
} from "~/store/funds/fundsCache";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * The all-funds method sweep, one shot per chain at a time. It walks every
 * vault on the chain to learn each method's pastNAVUpdateEntryFundAddress,
 * which costs seconds — so concurrent simulations share one walk, and its
 * result is cached for the next visit to serve without waiting at all.
 */
const sweepsInFlight = new Map<ChainId, Promise<void>>();

const sweepAllNavMethods = (fundChainId: ChainId): Promise<void> => {
  const running = sweepsInFlight.get(fundChainId);
  if (running) return running;

  const fundsStore = useFundsStore();
  const sweep = (async () => {
    const fundsInfoArrays = await fundsStore.fetchFundsInfoArrays(fundChainId);
    await fundsStore.fetchFundsNavMethods(fundChainId, fundsInfoArrays);
    writeCachedNavEntryMap(
      String(fundChainId),
      fundsStore.navMethodDetailsHashToFundAddress,
    );
  })().finally(() => {
    sweepsInFlight.delete(fundChainId);
  });

  sweepsInFlight.set(fundChainId, sweep);
  return sweep;
};

export const fetchSimulateCurrentNAVAction = async (
  fundChainId: ChainId,
  fundAddress: string,
  fundFactoryContractV2Used: boolean = false,
): Promise<void> => {
  const fundStore = useFundStore();
  const fundsStore = useFundsStore();
  const web3Store = useWeb3Store();
  const accountStore = useAccountStore();

  if (!fundsStore.allNavMethods[fundChainId]?.length) {
    // To get pastNAVUpdateEntryFundAddress we have to search for it in the fundsStore.allNavMethods
    // and make sure it is fetched before checking here with fundsStore.fetchFundsNavMethods, and then we
    // have to match by the detailsHash to extract the pastNAVUpdateEntryFundAddress
    //
    // This is a best-effort lookup, not a precondition: it walks every fund on
    // the chain and RPCs regularly answer "out of gas" for it. When it fails,
    // simulation still works — fetchSimulatedNAVMethodValue falls back to this
    // fund's own address. Letting the throw escape here used to abort the whole
    // simulation, leaving vaults with no valued positions at all.
    //
    // The walk costs seconds, and all it feeds this path is the small
    // detailsHash -> address map — so when last session's copy of that map is
    // cached, simulation starts on it immediately and the walk refreshes it
    // behind. Only a first-ever visit to a chain waits.
    try {
      const cachedMap = readCachedNavEntryMap(String(fundChainId));
      if (cachedMap && Object.keys(cachedMap).length) {
        fundsStore.navMethodDetailsHashToFundAddress = {
          ...cachedMap,
          ...fundsStore.navMethodDetailsHashToFundAddress,
        };
        sweepAllNavMethods(fundChainId).catch((error) => {
          console.warn("[CURRENT NAV] background method sweep failed", error);
        });
      } else {
        console.log("[CURRENT NAV] simulate fetch all nav methods");
        await sweepAllNavMethods(fundChainId);
      }
    } catch (error) {
      console.warn(
        "[CURRENT NAV] could not preload all NAV methods, simulating with this fund's address as fallback",
        error,
      );
    }
  }
  const safeAddress = fundStore.fund?.safeAddress || "";
  const baseDecimals = fundStore.fund?.baseToken?.decimals || 18;
  const baseSymbol = fundStore.fund?.baseToken?.symbol || "";

  // Simulate all at once as many promises instead of one by one.
  const promises = [];

  for (const navEntry of fundStore.fundNavMethods) {
    promises.push(
      accountStore.requestConcurrencyLimit(() =>
        web3Store.callWithRetry(
          fundChainId,
          () => fundStore.fetchSimulatedNAVMethodValue(
            fundChainId,
            fundAddress,
            safeAddress,
            baseDecimals,
            baseSymbol,
            navEntry,
            false,
            fundFactoryContractV2Used,
          ),
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
