import { useFundStore } from "../fund.store";

import type INAVUpdate from "~/types/nav_update";

export const parseFundNAVUpdatesAction = async (
  fundNAVData: any,
  fundAddress: string,
  fundContract: any,
): Promise<any> => {
  const fundStore = await useFundStore();
  const navUpdates = [] as INAVUpdate[];

  const navUpdatesLen = fundNAVData.updateTimes.length;
  const fundNavUpdateTimes = fundNAVData.updateTimes;

  const navParts = await fundStore.fetchNavParts(navUpdatesLen, fundAddress);

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

  // Fetch NAV JSON entries for each NAV update.
  const promises: Promise<any>[] = Array.from(
    { length: navUpdatesLen },
    (_, index) =>
      fundStore.accountStore.requestConcurrencyLimit(() =>
        fundStore.callWithRetry(() =>
          fundContract.methods.getNavEntry(index + 1).call(),
        ),
      ),
  );

  // Each NAV update has more entries.
  // Parse and store them to the NAV update entries.
  const navUpdatePromises = await Promise.allSettled(promises);

  // Process results
  navUpdatePromises.forEach((navUpdateResult, navUpdateIndex) => {
    if (navUpdateResult.status === "fulfilled") {
      const navMethods: Record<string, any>[] = navUpdateResult.value;
      // console.log("navMethods: ", navMethods);

      for (const [navMethodIndex, navMethod] of navMethods.entries()) {
        navUpdates[navUpdateIndex].entries.push(
          fundStore.parseNAVMethod(navMethodIndex, navMethod),
        );
      }
    } else {
      console.error(
        `Failed to fetch NAV entry ${navUpdateIndex + 1}:`,
        navUpdateResult.reason,
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
