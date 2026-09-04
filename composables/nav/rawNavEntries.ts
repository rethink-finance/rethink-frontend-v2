import { ethers } from "ethers";
import {
  NAVEntryTypeStringToNAVEntryTypeMap,
  NAVEntryTypeStringToPositionTypeMap,
} from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";
import type { INAVMethodDetails } from "~/types/nav_method";

/**
 * A NAV entry in the vault-export JSON spelling — what "Raw NAV methods"
 * accepts and what the positions registry's `compileValuation` emits.
 */
export interface IRawNavEntry {
  entryType: string;
  liquidUpdates?: unknown[];
  illiquidUpdates?: unknown[];
  nftUpdates?: unknown[];
  composableUpdates?: unknown[];
  isPastNAVUpdate?: boolean;
  pastNAVUpdateIndex?: number | string;
  pastNAVUpdateEntryIndex?: number | string;
  description?: { positionName?: string; valuationSource?: string };
  pastNAVUpdateEntryFundAddress?: string;
  [key: string]: unknown;
}

/**
 * Turns raw entries into the methods the tables and `updateNav` encoder
 * work with, indexed after `existingCount` methods. One mapping for the
 * raw paste form and the registry library, so both produce identical
 * `detailsHash`es for identical entries.
 */
export const rawEntriesToNavMethods = (
  entries: IRawNavEntry[],
  existingCount: number,
): INAVMethod[] =>
  entries.map((method, index) => {
    const entryType = NAVEntryTypeStringToNAVEntryTypeMap[method?.entryType];
    if (entryType === undefined) {
      throw new Error(`Unknown NAV entry type: ${String(method?.entryType)}`);
    }
    const details = {
      composable: method?.composableUpdates || [],
      description: JSON.stringify(method?.description || "{}"),
      entryType: entryType.toString(),
      illiquid: method?.illiquidUpdates || [],
      isPastNAVUpdate: method?.isPastNAVUpdate || false,
      liquid: method?.liquidUpdates || [],
      nft: method?.nftUpdates || [],
      pastNAVUpdateEntryIndex: method?.pastNAVUpdateEntryIndex || 0,
      pastNAVUpdateIndex: method?.pastNAVUpdateIndex || 0,
    } as INAVMethodDetails;
    const detailsJson = formatJson(details) || "{}";

    return {
      index: existingCount + index,
      isNew: true,
      details,
      detailsHash: ethers.keccak256(ethers.toUtf8Bytes(detailsJson)),
      detailsJson,
      foundMatchingPastNAVUpdateEntryFundAddress: false,
      isSimulatedNavError: false,
      pastNAVUpdateEntryFundAddress:
        method?.pastNAVUpdateEntryFundAddress || ethers.ZeroAddress,
      positionName: method?.description?.positionName || "",
      positionType: NAVEntryTypeStringToPositionTypeMap[method?.entryType] || "",
      simulatedNav: 0n,
      simulatedNavFormatted: "0 USDC",
      valuationSource: method?.description?.valuationSource || "",
    } as INAVMethod;
  });
