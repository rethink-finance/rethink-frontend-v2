import { useFundStore } from "../fund.store";

import {
  decodeNavPart,
  decodeNavUpdateEntry,
} from "~/composables/nav/navDecoder";


import type IFundNavData from "~/types/fund_nav_data";
import type INAVParts from "~/types/nav_parts";
import type INAVUpdate from "~/types/nav_update";

export const parseFundNAVUpdatesAction = async (
  fundNAVData: IFundNavData,
): Promise<any> => {
  const fundStore = await useFundStore();

  // Decode and parse navParts
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

  // Create navUpdates array
  const navUpdates = [] as INAVUpdate[];
  const navUpdatesLen = fundNAVData.updateTimes.length;
  const fundNavUpdateTimes = fundNAVData.updateTimes;
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

  // Parse NAV methods and populate entries and pastNavValues for the last update
  fundNAVData.encodedNavUpdate.forEach((navEntry, navEntryIndex) => {
    const navMethods: Record<string, any>[] = decodeNavUpdateEntry(navEntry);
    for (const [navMethodIndex, navMethod] of navMethods.entries()) {

      const parsedNavMethod = fundStore.parseNAVMethod(navMethodIndex, navMethod);
      if (navEntryIndex === navUpdatesLen - 1){
        parsedNavMethod.pastNavValueFormatted = undefined;
        parsedNavMethod.pastNavValue = fundNAVData[
          parsedNavMethod.positionType
        ][navEntryIndex].reduce((acc: bigint, val: bigint) => acc + val, 0n);
        parsedNavMethod.pastNavValueFormatted = fundStore.getFormattedBaseTokenValue(
          parsedNavMethod.pastNavValue,
        );
      }
      navUpdates[navEntryIndex].entries.push(parsedNavMethod);
    }
  });

  return navUpdates;
};
