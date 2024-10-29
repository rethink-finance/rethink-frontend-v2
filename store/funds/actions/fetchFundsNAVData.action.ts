import { excludeNAVDetailsHashes } from "../config/excludedNAVDetailsHashes.config";
import { useFundsStore } from "../funds.store";

import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { decodeNavUpdateEntry } from "~/composables/nav/navDecoder";
import { PositionType, PositionTypesMap } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
import type IPositionTypeCount from "~/types/position_type";

export async function fetchFundsNAVDataAction(
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

  // Process each fund's NAV data
  for (const [fundIndex, fundNavData] of allFundsNavData.entries()) {
    const fundAddress = fundAddresses[fundIndex];
    await processFundNavData(
      fundNavData,
      fundAddress,
      fundIndex,
      fundsStore,
      fundsInfoArrays,
      excludeNAVDetails,
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

  fundsStore.allNavMethods = allMethods;
  fundsStore.uniqueNavMethods = uniqueMethods;
}

async function processFundNavData(
  fundNAVData: any, // the type of FundNavData
  fundAddress: string,
  fundIndex: number,
  fundsStore: any,
  fundsInfoArrays: any[],
  excludeNAVDetails: boolean,
  allMethods: INAVMethod[],
) {
  const fund = fundsStore.funds[fundIndex];
  if (fund) {
    // Populate the positionTypeCounts array
    fund.positionTypeCounts = [
      {
        type: PositionTypesMap[PositionType.Liquid],
        count: Number(fundNAVData.liquidLen || 0),
      },
      {
        type: PositionTypesMap[PositionType.Composable],
        count: Number(fundNAVData.composableLen || 0),
      },
      {
        type: PositionTypesMap[PositionType.NFT],
        count: Number(fundNAVData.nftLen || 0),
      },
      {
        type: PositionTypesMap[PositionType.Illiquid],
        count: Number(fundNAVData.illiquidLen || 0),
      },
    ] as IPositionTypeCount[];
  }
  fundsStore.fundNAVUpdates[fundAddress] = [];

  if (!fundNAVData.encodedNavUpdate?.length) return;

  const fundContract = new fundsStore.web3.eth.Contract(
    GovernableFund.abi,
    fundAddress,
  );

  const navUpdates =
    await fundsStore.fundStore.parseFundNAVUpdates(
      fundNAVData,
      fundAddress,
      fundContract,
    );

  fundsStore.fundNAVUpdates[fundAddress] = navUpdates;
  const lastNavUpdate = navUpdates[navUpdates.length - 1];

  if (fund) {
    fund.lastNAVUpdateTotalNAV = navUpdates.length
      ? lastNavUpdate.totalNAV || 0n
      : fund.totalDepositBalance || 0n;
  }

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
        const parsedNavMethod: INAVMethod = fundsStore.fundStore.parseNAVMethod(
          navMethodIndex,
          navMethod,
        );

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
      console.log("Error processing NAV methods: ", error);
    }
  }
}
