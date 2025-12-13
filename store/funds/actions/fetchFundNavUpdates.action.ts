import { useActionState } from "~/store/actionState.store";
import { parseBigInt } from "~/composables/localStorage";
import type { ChainId } from "~/types/enums/chain_id";
import { excludeNAVUpdateIndexes } from "~/store/funds/config/excludedNAVUpdates.config";


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
export interface ParsedNavUpdateDto extends Omit<NavUpdateDto, "totalNAV" | "totalSupply" | "totalDepositBalance" | "sharePrice" | "navParts" | "timestamp" | "navUpdateIndex" > {
  index: number;
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

// Daily snapshots
interface DailyNavSnapshotDto {
  timestamp: string | number;
  sharePrice?: string | number | null;
  totalSimulatedNav?: string | number | null;
  totalSupply?: string | number | null;
  [key: string]: any;
}

export interface ParsedDailyNavSnapshotDto extends Omit<DailyNavSnapshotDto, "totalSimulatedNav" | "totalSupply" | "sharePrice" | "timestamp"> {
  timestamp: number;
  sharePrice?: number | null;
  totalSimulatedNav?: bigint | null;
  totalSupply?: bigint | null;
  date: string;
}

export function fetchFundDailyNavSnapshotsAction(fundChainId: ChainId, fundAddress: string): Promise<ParsedDailyNavSnapshotDto[]> {
  return useActionState(`fetchFundDailyNavSnapshots_${fundChainId}_${fundAddress}`, () =>
    fetchFundDailyNavSnapshots(fundChainId, fundAddress),
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

/**
 * Fetch fund daily NAV snapshots from the backend.
 */
export async function fetchFundDailyNavSnapshots(
  fundChainId: ChainId,
  fundAddress: string,
): Promise<ParsedDailyNavSnapshotDto[]> {
  console.debug("[BACKEND] FETCH Fund daily NAV snapshots ", fundChainId, fundAddress);
  const config = useRuntimeConfig();
  const response = await fetch(
    `${config.public.BACKEND_URL}/nav/daily-snapshots/${fundAddress}?fundChainId=${fundChainId}`,
  );

  if (!response.ok) {
    console.error(`[BACKEND] Failed to fetch daily NAV snapshots for fund ${fundChainId} ${fundAddress}:`, response.statusText);
    return [];
  }

  const data: DailyNavSnapshotDto[] = await response.json();
  console.debug("[BACKEND] Fund ", fundChainId, fundAddress, " DAILY SNAPSHOTS", data);
  return data.map((snapshot) => {
    const timestamp = Number(snapshot.timestamp);
    let totalSupply = snapshot.totalSupply;
    let totalSimulatedNav = snapshot.totalSimulatedNav;
    if (typeof totalSupply === "string") {
      totalSupply = totalSupply.replace(/n$/, "");
    }
    if (typeof totalSimulatedNav === "string") {
      totalSimulatedNav = totalSimulatedNav.replace(/n$/, "");
    }

    return {
      ...(snapshot as any),
      totalSimulatedNav: snapshot.totalSimulatedNav != null ? BigInt(totalSimulatedNav as any) : null,
      totalSupply: snapshot.totalSupply != null ? BigInt(totalSupply as any) : null,
      sharePrice: snapshot.sharePrice != null ? Number(snapshot.sharePrice as any) : null,
      timestamp,
      date: formatDate(new Date(timestamp)),
    } as ParsedDailyNavSnapshotDto;
  });
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
        index: navUpdate.navUpdateIndex,
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
