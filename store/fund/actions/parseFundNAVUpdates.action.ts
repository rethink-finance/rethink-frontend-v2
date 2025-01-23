import {
  decodeNavPart,
  decodeNavUpdateEntry,
} from "~/composables/nav/navDecoder";

import type IFundNavData from "~/types/fund_nav_data";
import type INAVParts from "~/types/nav_parts";
import type INAVUpdate from "~/types/nav_update";
import type INAVMethod from "~/types/nav_method";
import { PositionTypeToNAVCacheMethod } from "~/types/enums/position_type";
import { parseNAVMethod } from "~/composables/parseNavMethodDetails";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/store/web3/networksMap";

export const parseFundNAVUpdatesAction = async (
  fundChainId: ChainId,
  fundNAVData: IFundNavData,
  fundAddress: string,
) => {
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
  const navUpdates = reactive([] as INAVUpdate[]);
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
  fundNAVData.encodedNavUpdate.forEach((navUpdate, navUpdateIndex) => {
    const navMethods: Record<string, any>[] = decodeNavUpdateEntry(navUpdate);
    for (const [navMethodIndex, navMethod] of navMethods.entries()) {
      const parsedNavMethod = parseNAVMethod(navMethodIndex, navMethod);
      navUpdates[navUpdateIndex].entries.push(parsedNavMethod);
    }
  });

  // Only get past NAV update values for all methods for the last NAV update.
  const lastNavUpdateNavMethods =
    navUpdates[navUpdates.length - 1]?.entries ?? [];
  console.log("lastNavUpdateNavMethods: ", lastNavUpdateNavMethods);

  for (let i= 0; i< lastNavUpdateNavMethods.length; i++){
    await updateNavMethodPastNavValue(
      fundChainId,
      fundAddress,
      i,
      lastNavUpdateNavMethods[i],
    );
  }


  /*
  lastNavUpdateNavMethods.forEach((navMethod, navMethodIndex) => {
    updateNavMethodPastNavValue(
      fundChainId,
      fundAddress,
      navMethodIndex,
      navMethod,
    );
  });
  */

  return navUpdates;
};

const updateNavMethodPastNavValue = async (
  fundChainId: ChainId,
  fundAddress: string,
  navMethodIndex: number,
  navMethod: INAVMethod,
) => {
  const web3Store = useWeb3Store();
  const navCalculatorContract =
    web3Store.chainContracts[fundChainId]?.navCalculatorContract;
  if (!navCalculatorContract) {
    throw new Error(`No navCalculatorContract found for chainId: ${fundChainId}`);
  }

  // NOTE: Important to know, that this currently only works for the methods of the last NAV update.
  // Fetch NAV method cached past value.
  const calculatorMethod = PositionTypeToNAVCacheMethod[navMethod.positionType];

  navMethod.pastNavValue = undefined;
  navMethod.pastNavValueLoading = true;
  navMethod.pastNavValueError = false;

  try {
    const navCacheResult = await navCalculatorContract.methods[
      calculatorMethod
    ](fundAddress, navMethodIndex).call();
    navMethod.pastNavValue = navCacheResult.reduce(
      (acc: bigint, val: bigint) => acc + val,
      0n,
    );
  } catch (error) {
    navMethod.pastNavValueError = true;
    console.error(
      `Failed to fetch NAV method last NAV value ${navMethodIndex}:`,
      navMethod,
      error,
    );
  }
  navMethod.pastNavValueLoading = false;
};
