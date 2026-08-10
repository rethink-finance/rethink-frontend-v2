/**
 * How far back a chart looks, shared by the vault's share price chart and the
 * portfolio's performance chart.
 *
 * The defaults differ on purpose — a vault opens on its last month, a portfolio
 * on everything — but the windows, the fallback and the disabled states are one
 * behaviour in both places.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGE_WINDOWS: Record<string, number> = {
  "1M": 30 * DAY_MS,
  "3M": 90 * DAY_MS,
  "1Y": 365 * DAY_MS,
  ALL: Infinity,
};

export const RANGE_KEYS = Object.keys(RANGE_WINDOWS);

/**
 * The points a range covers, or null when it holds too few to draw a line.
 *
 * Two points is the threshold rather than one: a single reading is a dot, and a
 * chart drawn from it says nothing at all.
 */
export const pointsInRange = <T extends { timestamp: number }>(
  points: T[],
  rangeKey: string,
  now: number = Date.now(),
): T[] | null => {
  const windowMs = RANGE_WINDOWS[rangeKey];
  const visible = isFinite(windowMs)
    ? points.filter((point) => point.timestamp >= now - windowMs)
    : points;
  return visible.length >= 2 ? visible : null;
};

/** The ranges that can actually be drawn from these points. */
export const availableRanges = <T extends { timestamp: number }>(
  points: T[],
  now: number = Date.now(),
): Set<string> =>
    new Set(RANGE_KEYS.filter((range) => pointsInRange(points, range, now)));

/**
 * The range actually drawn, which is not always the one selected. Plenty of
 * vaults record a handful of NAV updates and nothing else, so they have no
 * points at all in the last month; widening to the narrowest range that can be
 * drawn beats an empty plot. The pills follow this rather than the selection,
 * or the chart shows two years of history under a highlighted "1M".
 */
export const resolveEffectiveRange = (
  selected: string,
  available: Set<string>,
): string =>
  available.has(selected)
    ? selected
    : (RANGE_KEYS.find((range) => available.has(range)) ?? "ALL");
