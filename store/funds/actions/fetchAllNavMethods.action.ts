import { excludeNAVDetailsHashes } from "../config/excludedNAVDetailsHashes.config";
import { useFundsStore } from "../funds.store";

import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { decodeNavUpdateEntry } from "~/composables/nav/navDecoder";
import type INAVMethod from "~/types/nav_method";

export async function fetchAllNavMethodsAction(
  fundsInfoArrays: any[],
  excludeNAVDetails: boolean,
): Promise<any> {
  const fundsStore = await useFundsStore();

  const fundAddresses: string[] = fundsInfoArrays[0];

  const allFundsNavData = await fundsStore.callWithRetry(() =>
    fundsStore.rethinkReaderContract.methods
      .getFundsNAVData(fundAddresses)
      .call(),
  );
  const allMethods: INAVMethod[] = [];
  fundsStore.navMethodDetailsHashToFundAddress = {};

  // console.log("allFundsNavData: ", allFundsNavData);
  console.log("Fetch all NAV methods");
  for (const [fundIndex, fundNavData] of allFundsNavData.entries()) {
    const fundAddress = fundAddresses[fundIndex];
    fundsStore.fundNAVUpdates[fundAddress] = [];
    if (!fundNavData.encodedNavUpdate?.length) continue;
    const fundContract = new fundsStore.web3.eth.Contract(
      GovernableFund.abi,
      fundAddress,
    );
    fundsStore.fundNAVUpdates[fundAddress] =
      await fundsStore.fundStore.parseFundNAVUpdates(
        allFundsNavData[fundIndex],
        fundAddress,
        fundContract,
      );
    for (const [
      navUpdateIndex,
      encodedNavUpdate,
    ] of fundNavData.encodedNavUpdate.entries()) {
      try {
        // Decode NAV update methods data.
        const navMethods: Record<string, any>[] =
          decodeNavUpdateEntry(encodedNavUpdate);

        for (const [navMethodIndex, navMethod] of navMethods.entries()) {
          // Ignore NAV methods that are not original NAV entries.
          if (
            navMethod.isPastNAVUpdate ||
            navMethod.pastNAVUpdateIndex !== 0n
          ) {
            // console.log("[SKIP] navMethod: ", navMethod);
            continue;
          }
          // console.log("[KEEP] navMethod: ", navMethod);
          const parsedNavMethod: INAVMethod =
            fundsStore.fundStore.parseNAVMethod(navMethodIndex, navMethod);

          if (
            excludeNAVDetails &&
            parsedNavMethod.detailsHash &&
            excludeNAVDetailsHashes[fundsStore.web3Store.chainId].includes(
              parsedNavMethod.detailsHash,
            )
          ) {
            continue;
          }

          // Set the past NAV update fund address to the original fund address
          // the entry was created on.
          parsedNavMethod.pastNAVUpdateEntryFundAddress = fundAddress;
          parsedNavMethod.pastNAVUpdateEntrySafeAddress =
            fundsInfoArrays[1][fundIndex].safe;
          allMethods.push(parsedNavMethod);
          if (parsedNavMethod.detailsHash) {
            fundsStore.navMethodDetailsHashToFundAddress[
              parsedNavMethod.detailsHash
            ] = fundAddress;
          } else {
            console.error(
              "Missing detailsHash for NAV method ",
              navUpdateIndex,
              navMethod,
            );
          }
        }
      } catch (error: any) {
        console.log("error processing all NAV methods: ", error);
      }
    }
  }

  console.log("allMethods: ", allMethods);
  interface IUniqueNAVMethods {
    [detailsHash: string]: boolean;
  }

  fundsStore.allNavMethods = allMethods;
  const seenValues = {} as IUniqueNAVMethods;
  const uniqueMethods = allMethods.filter((method: any) => {
    if (!seenValues[method.detailsHash]) {
      seenValues[method.detailsHash] = true;
      return true; // include value in the new list
    }
    return false; // exclude value from the new list
  });

  fundsStore.uniqueNavMethods = uniqueMethods;
}
