import type IFund from "~/types/fund";

/**
 * The figures the discover table prints: they come from the backend's latest
 * NAV snapshot, one round trip after the on-chain metadata that builds the
 * row, and they are also what the table sorts on.
 *
 * A row that already shows figures — last session's from the cache, or this
 * session's from an earlier refresh — keeps them until its own arrive.
 * Replacing it with a metadata-only row blanks three cells to spinners and,
 * with no NAV to sort on, sends it to the bottom of the table and back a
 * moment later; across five chains resolving at different times that reads
 * as the whole page reshuffling.
 */
export const LIVE_FIGURE_FIELDS = [
  "totalSimulatedNav",
  "totalSimulatedNavFormatted",
  "totalSimulatedNavUSD",
  "totalSimulatedNavUSDFormatted",
  "totalSimulatedNavCalculatedAt",
  "totalSimulatedNavCalculatedAtISO",
  "sharePrice",
  "lastNAVUpdateTotalNAV",
  "cumulativeReturnPercent",
  "sharpeRatio",
] as const satisfies readonly (keyof IFund)[];

type LiveFigureField = (typeof LIVE_FIGURE_FIELDS)[number];

const hasFigures = (fund: IFund | undefined): fund is IFund =>
  !!fund && !fund.isNavUpdatesLoading;

const rowKey = (fund: IFund): string => fund.address.toLowerCase();

/**
 * Copies the figures of `source` onto `target` in place. `source` also decides
 * whether the figures count as loaded, so a row can be reset to loading
 * through this as well.
 */
const copyFigures = (target: IFund, source: IFund): void => {
  for (const field of LIVE_FIGURE_FIELDS) {
    (target as Record<LiveFigureField, unknown>)[field] = source[field];
  }
  target.isNavUpdatesLoading = source.isNavUpdatesLoading;
};

/**
 * Fresh rows inherit the figures of the rows they replace, matched by address.
 * A predecessor that never got figures has nothing to pass on, and a fresh
 * row without a predecessor (a new vault) has nothing to inherit — both stay
 * loading, as on a cold load.
 */
export const inheritFigures = (fresh: IFund[], previous?: IFund[]): IFund[] => {
  if (!previous?.length) return fresh;
  const byAddress = new Map(previous.map((fund) => [rowKey(fund), fund]));
  for (const fund of fresh) {
    const predecessor = byAddress.get(rowKey(fund));
    if (hasFigures(predecessor)) copyFigures(fund, predecessor);
  }
  return fresh;
};

/**
 * Writes freshly fetched figures onto whichever rows a chain currently shows,
 * in place and matched by address. Rows the source does not know are left
 * alone.
 */
export const applyFigures = (
  rows: IFund[] | undefined,
  source: IFund[],
): void => {
  if (!rows?.length) return;
  const byAddress = new Map(source.map((fund) => [rowKey(fund), fund]));
  for (const fund of rows) {
    const update = byAddress.get(rowKey(fund));
    if (update) copyFigures(fund, update);
  }
};
