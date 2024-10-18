import { useFundStore } from "../fund.store";

import {
  decodeNavPart,
  decodeNavUpdateEntry,
} from "~/composables/nav/navDecoder";

import type { INAVParts } from "~/types/fund";

import type IFundNavData from "~/types/fund_nav_data";
import type INAVUpdate from "~/types/nav_update";

export const parseFundNAVUpdatesAction = async (
  fundNAVData: IFundNavData,
  fundAddress: string,
): Promise<any> => {
  const fundStore = await useFundStore();
  const navUpdates = [] as INAVUpdate[];

  const navUpdatesLen = fundNAVData.updateTimes.length;
  const fundNavUpdateTimes = fundNAVData.updateTimes;

  const navParts: (INAVParts | undefined)[] = [];
  fundNAVData.encodedNavParts.forEach((encodedNavPart) => {
    const decodedNavPart: Record<string, any> = decodeNavPart(encodedNavPart);
    navParts.push({
      baseAssetOIVBal: decodedNavPart.baseAssetOIVBal,
      baseAssetSafeBal: decodedNavPart.baseAssetSafeBal,
      feeBal: decodedNavPart.feeBal,
      totalNAV: decodedNavPart.totalNAV,
    } as INAVParts);
  });

  for (let i = 0; i < navUpdatesLen; i++) {
    const navTimestamp = Number(fundNavUpdateTimes[i] * 1000n);
    navUpdates.push({
      index: i + 1,
      date: fundNavUpdateTimes[i]
        ? formatDate(new Date(navTimestamp))
        : `#${(i + 1).toString()}}`,
      timestamp: navTimestamp,
      navParts: navParts[i],
      totalNAV: navParts[i]?.totalNAV,
      entries: [],
    });
  }

  fundNAVData.encodedNavUpdate.forEach((navEntry, navEntryIndex) => {
    const navMethods: Record<string, any>[] = decodeNavUpdateEntry(navEntry);
    for (const [navMethodIndex, navMethod] of navMethods.entries()) {
      navUpdates[navEntryIndex].entries.push(
        fundStore.parseNAVMethod(navMethodIndex, navMethod),
      );
    }
  });

  // console.log("fundNavUpdateTimes ", fundNavUpdateTimes);
  // TODO use this code when reader contract is fixed
  // Fetch NAV JSON entries for each NAV update.
  // const navUpdates: Record<string, any>[][] = dataNAV.encodedNavUpdate.map(decodeNavUpdateEntry);
  //
  // // Process results
  // for (const [navUpdateIndex, navMethods] of navUpdates.entries()) {
  //   // TODO remove this if when reader contract is fixed.
  //   if (!navMethods.length) continue
  //   for (const [navMethodIndex, navMethod] of navMethods.entries()) {
  //     const parsedNavMethod = this.parseNAVMethod(navMethodIndex, navMethod);
  //     // TODO this is not ok
  //     // parsedNavMethod.pastNavValue = dataNAV[parsedNavMethod.positionType][navUpdateIndex]
  //     navUpdates[navUpdateIndex].entries.push(parsedNavMethod)
  //   }
  // }
  console.warn("navUpdates: ", navUpdates, navUpdatesLen);
  const lastNavUpdateNavMethods =
    navUpdates[navUpdates.length - 1]?.entries ?? [];
  console.log("lastNavUpdateNavMethods: ", lastNavUpdateNavMethods);
  lastNavUpdateNavMethods.forEach((navMethod, navMethodIndex) => {
    fundStore.updateNavMethodPastNavValue(
      navMethodIndex,
      navMethod,
      fundAddress,
    );
  });
  return navUpdates;
};
