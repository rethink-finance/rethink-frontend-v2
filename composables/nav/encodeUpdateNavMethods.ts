import { type AbiFunctionFragment } from "web3";
import { encodeFunctionCall } from "web3-eth-abi";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import type INAVMethod from "~/types/nav_method";
import { PositionType } from "~/types/enums/position_type";
import { getMethodsPastNAVUpdateIndex } from "~/composables/nav/generateNAVPermission";

const updateNavABI = GovernableFund.abi.find(
  (func: any) => func.name === "updateNav" && func.type === "function",
);

/**
 * Use updateNav ABI to encode NAV methods array <INAVMethod>.
 * @param navMethods<INAVMethod>: a list of NAV methods.
 * @param baseDecimals<number>: base token decimals
 * @param processWithdraw<boolean>: set to true to process withdraws after NAV update
 */
export const encodeUpdateNavMethods = (
  navMethods: INAVMethod[],
  baseDecimals?: number,
  processWithdraw: boolean = false,
) => {
  const navUpdateEntries = [];
  const pastNavUpdateEntryAddresses: any[] = [];

  for (const navEntry of navMethods as INAVMethod[]) {
    // Skip deleted entries in the new proposal.
    if (navEntry.deleted) continue;

    const navEntryDetails = JSON.parse(JSON.stringify(navEntry.details));

    if (navEntry.pastNAVUpdateEntryFundAddress) {
      pastNavUpdateEntryAddresses.push(navEntry.pastNAVUpdateEntryFundAddress);
    }

    let pastNAVUpdateIndex = 0;

    if (navEntry.positionType === PositionType.Liquid) {
      navEntryDetails.liquid = prepNAVMethodLiquid(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Illiquid) {
      if (!baseDecimals) {
        throw new Error("Failed preparing NAV method, base decimals are not known.")
      }
      navEntryDetails.illiquid = prepNAVMethodIlliquid(
        navEntryDetails,
        baseDecimals,
      );
    } else if (navEntry.positionType === PositionType.NFT) {
      navEntryDetails.nft = prepNAVMethodNFT(navEntryDetails);
    } else if (navEntry.positionType === PositionType.Composable) {
      navEntryDetails.composable = prepNAVMethodComposable(navEntryDetails);
    }

    pastNAVUpdateIndex = getMethodsPastNAVUpdateIndex(
      navEntryDetails[navEntry.positionType],
    );

    // Stringify description, if it is not already.
    let descriptionJsonString = navEntryDetails.description;
    if (
      typeof descriptionJsonString === "object" &&
      descriptionJsonString !== null
    ) {
      descriptionJsonString = JSON.stringify(navEntryDetails.description);
    }
    navUpdateEntries.push([
      parseInt(navEntryDetails.entryType),
      toRaw(navEntryDetails.liquid),
      toRaw(navEntryDetails.illiquid),
      toRaw(navEntryDetails.nft),
      toRaw(navEntryDetails.composable),
      navEntryDetails.isPastNAVUpdate,
      pastNAVUpdateIndex,
      parseInt(navEntryDetails.pastNAVUpdateEntryIndex),
      descriptionJsonString,
    ]);
  }
  console.log("navUpdateEntries: ", navUpdateEntries);
  console.log("pastNavUpdateEntryAddresses: ", pastNavUpdateEntryAddresses);
  console.log("processWithdraw: ", processWithdraw);
  const encodedNavUpdateEntries = encodeFunctionCall(
    updateNavABI as AbiFunctionFragment,
    [
      navUpdateEntries,
      pastNavUpdateEntryAddresses,
      processWithdraw,
    ],
  );
  console.log("encodedNavUpdateEntries: ", encodedNavUpdateEntries);
  return encodedNavUpdateEntries;
}
