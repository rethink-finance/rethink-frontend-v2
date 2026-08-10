/**
 * Month-by-month performance, derived from the vault's share price.
 *
 * Share price is the only honest basis for a per-period return: it is value per
 * unit of ownership, so deposits and redemptions move NAV without moving it.
 * The headline cumulative return on the vault header answers a different
 * question — NAV measured against what was paid in — so the two are not
 * expected to agree, and this never tries to reconcile them.
 *
 * The prices themselves come from the backend, which reports them on a scale of
 * its own choosing per vault (nav/supply, undivided by decimals). That does not
 * matter here: every figure below is a ratio of two prices from the same vault,
 * and a constant scale cancels out. It is also what lets a vault with no share
 * count at all be measured from its NAV instead — see collectSeries.
 */

/** A share price the vault recorded at a point in time. */
export interface SharePriceObservation {
  timestamp: number;
  /** Null or non-positive where the vault could not be priced. */
  sharePrice?: number | null;
  /**
   * What the vault was worth at that moment. Only read for vaults that have no
   * share price at all — see the constant-supply fallback below.
   */
  totalNav?: number | bigint | null;
  /**
   * Shares in issue at that moment. Never measured directly — it decides only
   * whether NAV may stand in for share price. See shouldPriceFromNav.
   */
  totalSupply?: number | bigint | null;
}

/**
 * What the figures were measured from. "nav" means the vault has no share
 * price, so its own value stood in — see collectSeries. Callers should say so
 * rather than label a NAV as a price.
 */
export type MonthlyReturnBasis = "sharePrice" | "nav";

export interface MonthlyReturn {
  /** Calendar year, UTC. */
  year: number;
  /** 1–12, UTC. */
  month: number;
  /** Percent, e.g. -3.62 for a 3.62% loss. */
  percent: number;
  basis: MonthlyReturnBasis;
  /** The two observations behind the figure, so a cell can show its working. */
  fromPrice: number;
  toPrice: number;
  fromTimestamp: number;
  toTimestamp: number;
}

/**
 * One reading of what a share was worth, on whatever scale the vault reports.
 * Exported because the portfolio measures a wallet's holdings against the same
 * series — see collectSeries.
 */
export interface Point {
  timestamp: number;
  price: number;
}

/** A reading is usable when it is a real, positive number. */
const readValue = (
  raw: number | bigint | null | undefined,
): number | undefined => {
  if (raw == null) return undefined;
  // NAV arrives as a bigint far above Number's exact range. The loss is in
  // digits far below anything a percentage shows, and every use is a ratio.
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const byTimestamp = (a: { timestamp: number }, b: { timestamp: number }) =>
  a.timestamp - b.timestamp;

type ValueOf = (observation: SharePriceObservation) => number | undefined;

const bySharePrice: ValueOf = (o) => readValue(o.sharePrice);
const byTotalNav: ValueOf = (o) => readValue(o.totalNav);

/**
 * The observations worth measuring, newest last.
 *
 * Two rules earn their keep here:
 *
 * A settlement has to exist first. A vault with no NAV update has never been
 * valued on-chain, and the daily job still writes rows for it — a share price
 * struck against a dust supply during bootstrap, which reads as a catastrophic
 * loss the moment real deposits arrive. Nothing before the first settlement is
 * a price anyone actually transacted at.
 *
 * A repeated daily reading is dropped. When the job cannot value a vault it
 * rewrites the previous row verbatim, for months on end; taken at face value
 * those become a wall of 0.00% that says "flat" where the truth is "not
 * valued". An identical reading carries no new information, so only the first
 * of a run is kept and the months after it fall to "no data" instead. Settled
 * NAV updates are never dropped this way: each one is a deliberate on-chain
 * act, and one that happens to land on the previous price is still news.
 */
const collectPoints = (
  navUpdates: SharePriceObservation[],
  dailySnapshots: SharePriceObservation[],
  valueOf: ValueOf,
): Point[] => {
  if (!navUpdates.length) return [];
  const firstSettlement = Math.min(...navUpdates.map((u) => u.timestamp));

  const priceByTimestamp = new Map<number, number>();

  let previousPrice: number | undefined;
  for (const snapshot of [...dailySnapshots].sort(byTimestamp)) {
    if (snapshot.timestamp < firstSettlement) continue;
    const price = valueOf(snapshot);
    if (price === undefined || price === previousPrice) continue;
    previousPrice = price;
    priceByTimestamp.set(snapshot.timestamp, price);
  }

  // Written second, so a settlement wins wherever the two coincide.
  for (const update of navUpdates) {
    const price = valueOf(update);
    if (price === undefined) continue;
    priceByTimestamp.set(update.timestamp, price);
  }

  return [...priceByTimestamp.entries()]
    .map(([timestamp, price]) => ({ timestamp, price }))
    .sort(byTimestamp);
};

/**
 * Whether the vault's own value should stand in for its share price.
 *
 * A vault that never minted shares divides by zero and records a share price of
 * nought, which is not a 100% loss — it is the absence of a denominator. Its
 * NAV is recorded perfectly well throughout, and with the share count held
 * fixed, NAV and share price move together by definition. Every figure here is
 * a ratio of two readings, so the unknown share count cancels and the
 * percentages come out the same as if we knew it.
 *
 * Two things have to hold for that substitution to be honest, and the count of
 * usable prices is neither of them:
 *
 * The share count must never have moved. That is what makes NAV a fixed
 * multiple of share price rather than merely correlated with it. A vault taking
 * deposits fails this, and its NAV says nothing about what a share is worth.
 *
 * The price feed must have holes the NAV feed does not. Where every valued
 * moment also carries a price, the price is the better answer and there is
 * nothing to fall back from.
 *
 * Both are read from the data rather than assumed, because a feed can be
 * repaired underneath us: when the backend began pricing a zero-supply vault
 * correctly it fixed the newest rows and left the history at nought, and a rule
 * counting usable prices switched itself off the moment the second good row
 * landed — leaving a year of zeroes plotted as though the vault had been
 * worthless.
 */
export const shouldPriceFromNav = (
  observations: SharePriceObservation[],
): boolean => {
  const supplies = new Set<string>();
  let hasUnpricedValue = false;

  for (const observation of observations) {
    if (observation.totalSupply != null) {
      supplies.add(String(observation.totalSupply));
    }
    if (
      byTotalNav(observation) !== undefined &&
      bySharePrice(observation) === undefined
    ) {
      hasUnpricedValue = true;
    }
  }

  // Exactly one distinct reading, so a vault we hold no supply figures for is
  // never assumed to have a constant one.
  return supplies.size === 1 && hasUnpricedValue;
};

/**
 * The series to measure: share price where the vault has one, and otherwise the
 * vault's own value under a constant share count — see shouldPriceFromNav.
 *
 * One usable price is not enough to measure anything against either, so a
 * series that thin also falls back.
 */
export const collectSeries = (
  navUpdates: SharePriceObservation[],
  dailySnapshots: SharePriceObservation[],
): { points: Point[]; basis: MonthlyReturnBasis } => {
  const priced = collectPoints(navUpdates, dailySnapshots, bySharePrice);
  if (priced.length >= 2 && !shouldPriceFromNav([...navUpdates, ...dailySnapshots])) {
    return { points: priced, basis: "sharePrice" };
  }
  return {
    points: collectPoints(navUpdates, dailySnapshots, byTotalNav),
    basis: "nav",
  };
};

/**
 * One figure per calendar month that holds at least one observation.
 *
 * Each month is measured from the last price of the previous month that had
 * one, so nothing is invented for the months in between and no movement is
 * lost: compounding the whole column reproduces the change across the series
 * exactly. A month with no observation of its own is left out entirely rather
 * than shown as flat — the vault was not valued, which is not the same as
 * having gone nowhere.
 *
 * The first month is measured from its own first observation, that being the
 * earliest price there is to measure from.
 */
export const buildMonthlyReturns = (
  navUpdates: SharePriceObservation[],
  dailySnapshots: SharePriceObservation[] = [],
): MonthlyReturn[] => {
  const { points, basis } = collectSeries(navUpdates, dailySnapshots);
  if (points.length < 2) return [];

  const firstOfMonth = new Map<string, Point>();
  const lastOfMonth = new Map<string, Point>();
  for (const point of points) {
    const date = new Date(point.timestamp);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (!firstOfMonth.has(key)) firstOfMonth.set(key, point);
    lastOfMonth.set(key, point);
  }

  const returns: MonthlyReturn[] = [];
  let previous: Point | null = null;

  // Map preserves insertion order and the points were sorted, so this walks the
  // months in order.
  for (const [key, last] of lastOfMonth) {
    const opening = previous ?? firstOfMonth.get(key)!;
    previous = last;

    // The very first observation is the anchor, not a return.
    if (opening.timestamp === last.timestamp) continue;

    const [year, monthIndex] = key.split("-").map(Number);
    returns.push({
      year,
      month: monthIndex + 1,
      percent: (last.price / opening.price - 1) * 100,
      basis,
      fromPrice: opening.price,
      toPrice: last.price,
      fromTimestamp: opening.timestamp,
      toTimestamp: last.timestamp,
    });
  }

  return returns;
};
