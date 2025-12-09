import { useActionState } from "~/store/actionState.store";
import { parseBigInt } from "~/composables/localStorage";
import type { ChainId } from "~/types/enums/chain_id";
import { excludeNAVUpdateIndexes } from "~/store/funds/config/excludedNAVUpdates.config";
import type INAVUpdate from "~/types/nav_update";

interface NavUpdateDto {
  id: number;
  fundAddress: string;
  fundChainId: string;
  navUpdateIndex: number;
  safeAddress: string;
  baseDecimals: number;
  baseSymbol: string;
  baseTokenAddress: string;
  totalDepositBalance: bigint;
  sharePrice: string;
  totalNAV: string;
  totalSupply: string;
  navParts: string; // or: Record<string, string> if parsed
  timestamp: string; // or number if you parse it
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  navMethods: any[]; // or a specific type[]
  positionTypeCounts: any | null; // or a specific type | null
}
export interface ParsedNavUpdateDto extends Omit<NavUpdateDto, "totalNAV" | "totalSupply" | "totalDepositBalance" | "sharePrice" | "navParts" | "timestamp"> {
  totalNAV: bigint;
  totalSupply: bigint;
  totalDepositBalance: bigint;
  sharePrice: number;
  date: string;
  timestamp: number;
  navParts: Record<string, any>;
}

export function fetchFundNavUpdatesAction(fundChainId: ChainId, fundAddress: string): Promise<ParsedNavUpdateDto[]> {
  return useActionState(`fetchFundNavUpdates_${fundChainId}_${fundAddress}`, () =>
    fetchFundNavUpdates(fundChainId, fundAddress),
  );
}

/**
 * Fetch fund NAV updates from the backend including share prices.
 */
export async function fetchFundNavUpdates(fundChainId: ChainId, fundAddress: string): Promise<ParsedNavUpdateDto[]> {
  console.debug("[BACKEND] FETCH Fund NAV updates ", fundChainId, fundAddress);
  const config = useRuntimeConfig();
  const response = await fetch(
    `${config.public.BACKEND_URL}/nav/nav-updates/${fundAddress}?fundChainId=${fundChainId}`,
  );

  if (!response.ok) {
    console.error(`[BACKEND] Failed to fetch NAV updates for fund ${fundChainId} ${fundAddress}:`, response.statusText);
    return [];
  }

  const data = await response.json();
  console.debug("[BACEKND] Fund ", fundChainId, fundAddress," NAV UPDATES", data);
  return parseFundNavUpdatesResponse(fundChainId, fundAddress, data);
}


const parseFundNavUpdatesResponse = (fundChainId: ChainId, fundAddress: string, navUpdatesData: NavUpdateDto[]): ParsedNavUpdateDto[] => {
  // Filter out NAV updates if their index is in the excludeNAVUpdateIndexes for that fund
  const excludedIndexes = excludeNAVUpdateIndexes[(fundChainId)]?.[fundAddress] || [];
  return navUpdatesData
    .filter((navUpdate: NavUpdateDto) => !excludedIndexes.includes(navUpdate.navUpdateIndex))
    .map((navUpdate: any) => {
      const timestamp = Number(navUpdate.timestamp);

      return {
        ...navUpdate,
        totalNAV: navUpdate.totalNAV != null ? BigInt(navUpdate.totalNAV) : null,
        totalSupply: navUpdate.totalSupply != null ? BigInt(navUpdate.totalSupply) : null,
        sharePrice: Number(navUpdate.sharePrice),
        totalDepositBalance: navUpdate.totalDepositBalance != null ? BigInt(navUpdate.totalDepositBalance) : null,
        timestamp,
        date: formatDate(new Date(timestamp)),
        navParts: typeof navUpdate.navParts === "string" ? JSON.parse(navUpdate.navParts, parseBigInt) : (navUpdate.navParts || {}),
      }
    });
}
