import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "~/composables/localStorage";
import type {
  ParsedDailyNavSnapshotDto,
  ParsedNavUpdateDto,
} from "~/store/funds/actions/fetchFundNavUpdates.action";
import type IFund from "~/types/fund";
import type INAVMethod from "~/types/nav_method";

/**
 * Stale-while-revalidate cache for a vault's details page.
 *
 * A refresh of the page used to be three skeleton cards until the metadata
 * request returned, and then eight sections each filling in on their own
 * round trip. Everything those sections show is kept here from the last
 * visit — the fund object, the backend NAV feeds the chart and the monthly
 * returns read, the activity rows, the Roles modifier address — so the page
 * paints complete on the first frame and every fetch refreshes its part in
 * place behind it. Nothing here is authoritative. A vault opened for the
 * first time has no entry and takes the cold path it always took.
 */

const KEY = "fund.overview";

/** Bump when the shape of anything stored here changes. */
const CACHE_VERSION = 1;

/** A vault not opened for this long is served cold again. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Only the vaults opened most recently are kept: a vault's feeds can run to a
 * few hundred KB of history, and localStorage holds about 5 MB in all.
 */
const MAX_VAULTS = 8;

/** Feeds are capped from the recent end; nothing on the page needs more. */
const MAX_FEED_ENTRIES = 500;

/** Enough for the pages of activity anyone scrolls before the fresh rows land. */
const MAX_ACTIVITY_ROWS = 100;

/** A display-ready activity row, as the Activity card builds them. */
export interface CachedActivityRow {
  id: string;
  kind: string;
  label: string;
  dot: string;
  address?: string;
  roleLabel?: string;
  amount: string;
  amountUsd?: string;
  timestamp: number;
  when: string;
  txHash?: string;
}

export interface FundOverviewEntry {
  visitedAt: number;
  fund?: IFund;
  backendNavUpdates?: ParsedNavUpdateDto[];
  backendDailyNavSnapshots?: ParsedDailyNavSnapshotDto[];
  roleModAddress?: string;
  activityRows?: CachedActivityRow[];
  /**
   * The methods a vault that has never settled values its positions with,
   * simulated values included — what its Composition card is drawn from.
   */
  initialNavMethods?: INAVMethod[];
  /** The settlement cycle as prose ("3 days"); parsing it reads the chain's block time. */
  plannedSettlement?: string;
}

type FundOverviewPatch = Partial<Omit<FundOverviewEntry, "visitedAt">>;

interface CacheEnvelope {
  version: number;
  savedAt: number;
  data: Record<string, FundOverviewEntry>;
}

const entryKey = (chainId: string, address: string): string =>
  `${chainId}:${address.toLowerCase()}`;

const readAll = (): Record<string, FundOverviewEntry> => {
  try {
    const entry: CacheEnvelope | null = getLocalStorageItem(KEY, null);
    if (!entry || entry.version !== CACHE_VERSION) return {};
    return entry.data ?? {};
  } catch {
    return {};
  }
};

const writeAll = (data: Record<string, FundOverviewEntry>): void => {
  try {
    setLocalStorageItem(KEY, {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      data,
    } satisfies CacheEnvelope);
  } catch {
    // Quota exceeded or storage blocked — the page works without the cache.
  }
};

/**
 * Fields that are loaded by their own fetch and cached on their own, or that
 * describe a request in flight rather than the vault.
 */
const FUND_FIELDS_NOT_CACHED: readonly (keyof IFund)[] = [
  "navUpdates",
  "backendNavUpdates",
  "backendDailyNavSnapshots",
  "fundContractBaseTokenBalanceLoading",
  "fundContractBaseTokenBalanceError",
  "pendingDepositBalanceLoading",
  "pendingDepositBalanceError",
  "pendingRedemptionBalanceLoading",
  "pendingRedemptionBalanceError",
];

export const slimFund = (fund: IFund): IFund => {
  const copy = { ...fund } as Partial<IFund>;
  for (const field of FUND_FIELDS_NOT_CACHED) delete copy[field];
  return { ...copy, navUpdates: [] } as IFund;
};

/** The most recent entries, in the order the feed came in. */
const keepMostRecent = <T extends { timestamp: number }>(items: T[]): T[] => {
  if (items.length <= MAX_FEED_ENTRIES) return items;
  const cutoff = [...items].sort((a, b) => b.timestamp - a.timestamp)[
    MAX_FEED_ENTRIES - 1
  ].timestamp;
  return items.filter((item) => item.timestamp >= cutoff);
};

/**
 * The chart and the monthly returns read a handful of scalars per update.
 * The method list is the bulk of one and goes.
 */
export const compactNavUpdates = (
  updates: ParsedNavUpdateDto[],
): ParsedNavUpdateDto[] =>
  keepMostRecent(updates).map((update) => ({ ...update, navMethods: [] }));

export const compactDailySnapshots = (
  snapshots: ParsedDailyNavSnapshotDto[],
): ParsedDailyNavSnapshotDto[] =>
  keepMostRecent(snapshots).map(
    ({ timestamp, date, sharePrice, totalSimulatedNav, totalSupply }) => ({
      timestamp,
      date,
      sharePrice,
      totalSimulatedNav,
      totalSupply,
    }),
  );

const prune = (
  data: Record<string, FundOverviewEntry>,
): Record<string, FundOverviewEntry> => {
  const now = Date.now();
  const fresh = Object.entries(data).filter(
    ([, entry]) => now - (entry?.visitedAt ?? 0) <= MAX_AGE_MS,
  );
  fresh.sort(([, a], [, b]) => b.visitedAt - a.visitedAt);
  return Object.fromEntries(fresh.slice(0, MAX_VAULTS));
};

export const readCachedFundOverview = (
  chainId: string,
  address: string,
): FundOverviewEntry | null => {
  const entry = readAll()[entryKey(chainId, address)];
  if (!entry || Date.now() - entry.visitedAt > MAX_AGE_MS) return null;
  return entry;
};

/**
 * Merges what one fetch learned into the vault's entry. Each part of the
 * page lands at its own time, so the entry is built up patch by patch, and
 * every patch counts as a visit.
 */
export const patchCachedFundOverview = (
  chainId: string,
  address: string,
  patch: FundOverviewPatch,
): void => {
  const all = readAll();
  const key = entryKey(chainId, address);
  const next: FundOverviewEntry = {
    ...(all[key] ?? { visitedAt: 0 }),
    visitedAt: Date.now(),
  };
  if (patch.fund) next.fund = slimFund(patch.fund);
  if (patch.backendNavUpdates) {
    next.backendNavUpdates = compactNavUpdates(patch.backendNavUpdates);
  }
  if (patch.backendDailyNavSnapshots) {
    next.backendDailyNavSnapshots = compactDailySnapshots(
      patch.backendDailyNavSnapshots,
    );
  }
  if (patch.roleModAddress) next.roleModAddress = patch.roleModAddress;
  if (patch.activityRows) {
    next.activityRows = patch.activityRows.slice(0, MAX_ACTIVITY_ROWS);
  }
  if (patch.initialNavMethods) next.initialNavMethods = patch.initialNavMethods;
  if (patch.plannedSettlement) next.plannedSettlement = patch.plannedSettlement;
  all[key] = next;
  writeAll(prune(all));
};
