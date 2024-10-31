
import { useFundStore } from "../fund.store";


import {
  PositionType,
  PositionTypeToNAVCalculationMethod,
} from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";

export const fetchSimulatedNAVMethodValueAction = async (
  navEntry: INAVMethod,
): Promise<void> => {
  const fundStore = useFundStore();

  if (!fundStore.web3Store.web3) {
    console.error("Web3 instance is not available.");
    return;
  }
  if (!navEntry.detailsHash) {
    console.error("No detailsHash provided in navEntry.");
    return;
  }

  const baseDecimals = fundStore.fund?.baseToken.decimals;
  if (!baseDecimals) {
    console.error("simulateNAVMethodValue error: No fund base decimals.");
    return;
  }

  try {
    navEntry.foundMatchingPastNAVUpdateEntryFundAddress = true;

    if (!navEntry.pastNAVUpdateEntryFundAddress) {
      navEntry.pastNAVUpdateEntryFundAddress =
        fundStore.fundsStore.navMethodDetailsHashToFundAddress[
          navEntry.detailsHash ?? ""
        ];
    }
    if (!navEntry.pastNAVUpdateEntryFundAddress) {
      // If there is no pastNAVUpdateEntryFundAddress the simulation will fail later.
      // A missing pastNAVUpdateEntryFundAddress can mean two things:
      //   1) A proposal is not approved yet and so its methods are not yet in the allNavMethods
      //     -> that means the method was created on this fund, so we take address of this fund.
      //  2) There was some difference when hashing details on INAVMethod detailsHash.
      //    -> it will be hard to detect this, NAV simulation will fail, and we will take a look what happened.
      //    -> We have a bigger problem if it won't fail, we should mark the address somewhere in the table.
      //
      // Here we take solution 1), as we assume that the method was not yet added to allMethods
      navEntry.pastNAVUpdateEntryFundAddress = fundStore.fund?.address;
      navEntry.foundMatchingPastNAVUpdateEntryFundAddress = false;
    }

    const callData: any[] = [];
    if (navEntry.positionType === PositionType.Liquid) {
      callData.push(prepNAVMethodLiquid(navEntry.details));
      callData.push(fundStore.fund?.safeAddress);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      callData.push(prepNAVMethodIlliquid(navEntry.details, baseDecimals));
      callData.push(fundStore.fund?.safeAddress);
    } else if (navEntry.positionType === PositionType.NFT) {
      callData.push(prepNAVMethodNFT(navEntry.details));
      // callData.push(this.fundStore.fund?.safeAddress);
    } else if (navEntry.positionType === PositionType.Composable) {
      callData.push(
        prepNAVMethodComposable(
          navEntry.details,
          navEntry.pastNAVUpdateEntrySafeAddress,
          fundStore.fund?.safeAddress,
        ),
      );
    }

    callData.push(
      ...[
        fundStore.fund?.address, // fund
        0, // navEntryIndex
        false, // isPastNAVUpdate -- set to false to simulate on current fund.
        parseInt(navEntry.details.pastNAVUpdateIndex), // pastNAVUpdateIndex
        parseInt(navEntry.details.pastNAVUpdateEntryIndex), // pastNAVUpdateEntryIndex
        navEntry.pastNAVUpdateEntryFundAddress, // pastNAVUpdateEntryFundAddress
      ],
    );

    // console.log("json: ", JSON.stringify(callData, null, 2))
    const navCalculationMethod =
      PositionTypeToNAVCalculationMethod[navEntry.positionType];
    navEntry.simulatedNavFormatted = "N/A";
    navEntry.simulatedNav = 0n;

    // console.log("navCalculationMethod:", navCalculationMethod);
    // console.log("callData:", callData);
    try {
      const simulatedVal: bigint = await fundStore.callWithRetry(
        () =>
          fundStore.navCalculatorContract.methods[navCalculationMethod](
            ...callData,
          ).call(),
        5,
        [-32603], // Do not retry internal errors (probably invalid NAV method)
      );
      console.warn("simulated value: ", simulatedVal);

      navEntry.simulatedNavFormatted =
        fundStore.getFormattedBaseTokenValue(simulatedVal);
      navEntry.simulatedNav = simulatedVal;
      navEntry.isSimulatedNavError = false;
    } catch (error: any) {
      navEntry.isSimulatedNavError = true;
      console.error(
        "simulateNAVMethodValue: Failed simulating value for entry, check if there was some difference " +
          "when hashing details on INAVMethod detailsHash: ",
        navEntry,
        error,
      );
    }
  } catch (error: any) {
    console.error("simulateNAVMethodValue error: ", error);
  }
};