import {
  getLocalStorageItem,
  parseBigInt,
  setLocalStorageItem,
  stringifyBigInt,
} from "~/composables/localStorage";
import type IFund from "~/types/fund";
import type INAVUpdate from "~/types/nav_update";

/**
 * Stale-while-revalidate cache for the Discover table.
 *
 * The discover page needs 3 sequential round trips per chain (factory ->
 * reader multicall -> backend snapshots) before a single row can render,
 * so a cold load takes several seconds. We keep the last good result and
 * paint it on the first frame, then let the normal fetch overwrite it as
 * each chain resolves. Nothing here is authoritative — it only decides
 * what is on screen while the real request is still in flight.
 */

const FUNDS_KEY = "discover.chainFunds";
const TVL_KEY = "discover.totalTVL";

/**
 * Bump when the shape of IFund changes, so old entries are discarded
 * instead of being read back with missing fields.
 */
const CACHE_VERSION = 1;

/** Past this age we'd rather show an empty table than misleading numbers. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  version: number;
  savedAt: number;
  data: T;
}

const read = <T>(key: string): T | null => {
  try {
    const entry: CacheEnvelope<T> | null = getLocalStorageItem(key, null);
    if (!entry || entry.version !== CACHE_VERSION) return null;
    if (Date.now() - entry.savedAt > MAX_AGE_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
};

const write = <T>(key: string, data: T): void => {
  try {
    setLocalStorageItem(key, {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      data,
    } satisfies CacheEnvelope<T>);
  } catch {
    // Quota exceeded or storage blocked — the app works without the cache.
  }
};

export const readCachedChainFunds = (): Record<string, IFund[]> | null =>
  read<Record<string, IFund[]>>(FUNDS_KEY);

export const writeCachedChainFunds = (
  chainFunds: Record<string, IFund[]>,
): void => {
  // navUpdates is the bulk of a fund object and the table never reads it,
  // so drop it rather than blow through the localStorage quota.
  const slim = Object.fromEntries(
    Object.entries(chainFunds).map(([chainId, funds]) => [
      chainId,
      funds.map((fund) => ({ ...fund, navUpdates: [] })),
    ]),
  );
  write(FUNDS_KEY, slim);
};

export const readCachedTotalTVL = <T>(): T | null => read<T>(TVL_KEY);

export const writeCachedTotalTVL = <T>(data: T): void => write(TVL_KEY, data);

/**
 * 30D sparkline series, keyed by chain + vault. These are one request per
 * row, so on a cold load the trend column fills in a row at a time over a
 * second or two. Caching the plotted points lets the whole column draw with
 * the rest of the table while the refresh happens behind it.
 */
const SPARKLINE_KEY = "discover.sparklines";

type SparklineSeries = Record<string, number[]>;

const sparklineKey = (chainId: string, address: string) =>
  `${chainId}:${address.toLowerCase()}`;

export const readCachedSparkline = (
  chainId: string,
  address: string,
): number[] | null =>
  read<SparklineSeries>(SPARKLINE_KEY)?.[sparklineKey(chainId, address)] ??
  null;

export const writeCachedSparkline = (
  chainId: string,
  address: string,
  prices: number[],
): void => {
  const all = read<SparklineSeries>(SPARKLINE_KEY) ?? {};
  all[sparklineKey(chainId, address)] = prices;
  write(SPARKLINE_KEY, all);
};

/**
 * detailsHash -> fund address of the past NAV entry, per chain — what the NAV
 * simulation needs from the all-funds method sweep. The sweep walks every
 * vault on the chain and costs seconds; this map is a few KB of essentially
 * append-only history, so serving last session's copy and refreshing behind
 * it loses nothing but the wait.
 */
const NAV_ENTRY_MAP_KEY = "simulate.navEntryMap";

type NavEntryMaps = Record<string, Record<string, string>>;

export const readCachedNavEntryMap = (
  chainId: string,
): Record<string, string> | null =>
  read<NavEntryMaps>(NAV_ENTRY_MAP_KEY)?.[chainId] ?? null;

/**
 * A vault's most recent NAV update, methods included. The on-chain read of the
 * full history takes seconds on a vault that has settled many times, and the
 * only thing the overview needs from it early is the current method list —
 * so last session's final update is served first and the fresh read replaces
 * it. Methods only change when an update executes, so the stale copy is
 * almost always already right; when it is not, the simulation re-keys off the
 * fresh methods on its own.
 *
 * BigInts survive through the app's tagged-string round trip.
 */
const LAST_NAV_UPDATE_KEY = "fund.lastNavUpdate";

type LastNavUpdates = Record<string, unknown>;

const lastNavUpdateKey = (chainId: string, address: string) =>
  `${chainId}:${address.toLowerCase()}`;

export const readCachedLastNavUpdate = (
  chainId: string,
  address: string,
): INAVUpdate | null => {
  const entry = read<LastNavUpdates>(LAST_NAV_UPDATE_KEY)?.[
    lastNavUpdateKey(chainId, address)
  ];
  if (!entry) return null;
  try {
    // The storage layer has already revived tagged BigInts, so the deep copy
    // has to tag them again on the way through.
    return JSON.parse(JSON.stringify(entry, stringifyBigInt), parseBigInt);
  } catch {
    return null;
  }
};

export const writeCachedLastNavUpdate = (
  chainId: string,
  address: string,
  update: INAVUpdate,
): void => {
  try {
    const all = read<LastNavUpdates>(LAST_NAV_UPDATE_KEY) ?? {};
    all[lastNavUpdateKey(chainId, address)] = JSON.parse(
      JSON.stringify(update, stringifyBigInt),
    );
    write(LAST_NAV_UPDATE_KEY, all);
  } catch {
    // An unserializable update just goes uncached.
  }
};

export const writeCachedNavEntryMap = (
  chainId: string,
  map: Record<string, string>,
): void => {
  const all = read<NavEntryMaps>(NAV_ENTRY_MAP_KEY) ?? {};
  all[chainId] = map;
  write(NAV_ENTRY_MAP_KEY, all);
};
