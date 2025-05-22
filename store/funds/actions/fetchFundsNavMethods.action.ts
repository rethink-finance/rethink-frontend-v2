import { excludeNAVDetailsHashes } from "../config/excludedNAVDetailsHashes.config";
import { useFundsStore } from "../funds.store";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { decodeNavUpdateEntry } from "~/composables/nav/navDecoder";
import { parseNavMethodsPositionTypeCounts } from "~/composables/nav/parseNavMethodsPositionTypeCounts";
import { parseNAVMethod } from "~/composables/parseNavMethodDetails";
import { useWeb3Store } from "~/store/web3/web3.store";
import { type ChainId } from "~/types/enums/chain_id";
import type INAVMethod from "~/types/nav_method";

// Set to true if you want to exclude NAV methods that are defined excludeNAVDetailsHashes.
const excludeNAVDetails: boolean = true;

export async function fetchFundsNavMethodsAction(
  chainId: ChainId,
  fundsInfoArrays: any[],
  storeAllMethods: boolean = true,
): Promise<any> {
  console.log("start calculating fund nav data ", chainId);
  const fundsStore = useFundsStore();
  const web3Store = useWeb3Store();
  const fundAddresses: string[] = fundsInfoArrays[0];

  const rethinkReaderContract =
    web3Store.chainContracts[chainId]?.rethinkReaderContract;
  if (!rethinkReaderContract) {
    throw new Error(`No reader contract found for chainId: ${chainId}`);
  }
  console.log("start calculating fund nav data rethinkReaderContract", chainId, rethinkReaderContract);

  const allFundsNavData = await rethinkReaderContract.methods
    .getFundsNAVData(fundAddresses)
    .call();

  const allMethods: INAVMethod[] = [];
  fundsStore.navMethodDetailsHashToFundAddress = {};

  // Process each fund's NAV data
  for (const [fundIndex, fundNavData] of allFundsNavData.entries()) {
    const fundAddress = fundAddresses[fundIndex];
    await processFundNavData(
      chainId,
      fundNavData,
      fundAddress,
      fundIndex,
      fundsStore,
      fundsInfoArrays,
      allMethods,
    );
  }

  // Remove duplicate methods based on detailsHash
  const uniqueMethodsMap = new Map<string, INAVMethod>();
  for (const method of allMethods) {
    if (method.detailsHash && !uniqueMethodsMap.has(method.detailsHash)) {
      uniqueMethodsMap.set(method.detailsHash, method);
    }
  }
  const uniqueMethods = Array.from(uniqueMethodsMap.values());

  if (storeAllMethods) {
    fundsStore.allNavMethods[chainId] = allMethods;
    fundsStore.uniqueNavMethods[chainId] = uniqueMethods;
  }
}

async function processFundNavData(
  chainId: ChainId, // the type of FundNavData
  fundNAVData: any, // the type of FundNavData
  fundAddress: string,
  fundIndex: number,
  fundsStore: any,
  fundsInfoArrays: any[],
  allMethods: INAVMethod[],
) {
  const web3Store = useWeb3Store();
  fundsStore.chainFundNAVUpdates[chainId][fundAddress] = [];

  if (!fundNAVData.encodedNavUpdate?.length) return;
  const fundContract = web3Store.getCustomContract(
    chainId,
    GovernableFund.abi,
    fundAddress,
  );
  const navUpdates = await fundsStore.fundStore.parseFundNAVUpdates(
    chainId,
    fundNAVData,
    fundAddress,
    fundContract,
  );

  fundsStore.chainFundNAVUpdates[chainId][fundAddress] = navUpdates;
  if (fundsStore.chainFunds?.[chainId]?.[fundIndex]) {
    // Save NAV updates to the fund in store.
    fundsStore.chainFunds[chainId][fundIndex].navUpdates = navUpdates;
  }
  const lastNavUpdate = navUpdates[navUpdates.length - 1];

  const fund = fundsStore.chainFunds[chainId]?.[fundIndex];

  for (const [
    navUpdateIndex,
    encodedNavUpdate,
  ] of fundNAVData.encodedNavUpdate.entries()) {
    try {
      // Decode NAV update methods data.
      const navMethods: Record<string, any>[] =
        decodeNavUpdateEntry(encodedNavUpdate);

      for (const [navMethodIndex, navMethod] of navMethods.entries()) {
        // Ignore NAV methods that are not original NAV entries.
        if (navMethod.isPastNAVUpdate || navMethod.pastNAVUpdateIndex !== 0n) {
          continue;
        }
        const parsedNavMethod: INAVMethod = parseNAVMethod(
          navMethodIndex,
          navMethod,
        );

        if (
          excludeNAVDetails &&
          parsedNavMethod.detailsHash &&
          excludeNAVDetailsHashes[chainId]?.includes(
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
            parsedNavMethod.detailsHash as string
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
      console.log("Error processing NAV methods: ", error);
    }
  }

  if (fund) {
    fund.positionTypeCounts = parseNavMethodsPositionTypeCounts(
      lastNavUpdate?.entries,
      lastNavUpdate,
    );

    fund.lastNAVUpdateTotalNAV = navUpdates.length
      ? lastNavUpdate.totalNAV || 0n
      : fund.totalDepositBalance || 0n;
  }
}
