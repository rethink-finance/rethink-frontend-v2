/**
 * Donut geometry, shared by every "what is this made of" chart in the app —
 * the vault's composition and the portfolio's allocation.
 *
 * Segments are real arc paths rather than a dashed circle stroke. A dashed
 * stroke draws a sub-percent slice as a skewed wedge wherever the dash wraps
 * the circle's seam, which is exactly the case a portfolio with one dominant
 * position hits.
 */

/** Design's slice palette, brightest first — callers sort rows to match. */
export const DONUT_COLORS = [
  "#2fd7ff",
  "#2c8bff",
  "#1f5fff",
  "#5ae0c8",
  "#7b8dff",
  "#8892a8",
];

/** Colour for the nth slice, cycling once the palette runs out. */
export const donutColor = (index: number) =>
  DONUT_COLORS[index % DONUT_COLORS.length];

export interface DonutGeometry {
  /** Centre of the square viewBox. */
  center: number;
  radiusOuter: number;
  radiusInner: number;
}

/** The 200x200 viewBox both cards draw in. */
export const DEFAULT_DONUT: DonutGeometry = {
  center: 100,
  radiusOuter: 87,
  radiusInner: 53,
};

const TAU = Math.PI * 2;

const pointOn = (geometry: DonutGeometry, radius: number, angle: number) => [
  (geometry.center + radius * Math.cos(angle)).toFixed(3),
  (geometry.center + radius * Math.sin(angle)).toFixed(3),
];

/** A closed ring, for the case where one position is the entire total. */
const fullRingPath = ({ center, radiusOuter, radiusInner }: DonutGeometry) =>
  `M ${center} ${center - radiusOuter}` +
  ` A ${radiusOuter} ${radiusOuter} 0 1 1 ${center} ${center + radiusOuter}` +
  ` A ${radiusOuter} ${radiusOuter} 0 1 1 ${center} ${center - radiusOuter} Z` +
  ` M ${center} ${center - radiusInner}` +
  ` A ${radiusInner} ${radiusInner} 0 1 0 ${center} ${center + radiusInner}` +
  ` A ${radiusInner} ${radiusInner} 0 1 0 ${center} ${center - radiusInner} Z`;

/**
 * One slice, as a path. `start` and `fraction` are both shares of the whole
 * circle; angles run clockwise from twelve o'clock so the ring reads in the
 * same order as the legend beside it.
 */
export const donutSegmentPath = (
  start: number,
  fraction: number,
  geometry: DonutGeometry = DEFAULT_DONUT,
): string => {
  if (fraction >= 0.99995) return fullRingPath(geometry);

  const { radiusOuter, radiusInner } = geometry;
  const from = start * TAU - Math.PI / 2;
  const to = (start + fraction) * TAU - Math.PI / 2;
  const largeArc = fraction > 0.5 ? 1 : 0;

  const [x0o, y0o] = pointOn(geometry, radiusOuter, from);
  const [x1o, y1o] = pointOn(geometry, radiusOuter, to);
  const [x1i, y1i] = pointOn(geometry, radiusInner, to);
  const [x0i, y0i] = pointOn(geometry, radiusInner, from);

  return (
    `M ${x0o} ${y0o}` +
    ` A ${radiusOuter} ${radiusOuter} 0 ${largeArc} 1 ${x1o} ${y1o}` +
    ` L ${x1i} ${y1i}` +
    ` A ${radiusInner} ${radiusInner} 0 ${largeArc} 0 ${x0i} ${y0i} Z`
  );
};

export interface DonutSlice<T> {
  item: T;
  /** Share of the whole, 0–1. */
  fraction: number;
  path: string;
  color: string;
}

/**
 * Turns a list of weighted items into slices, in the order given. Items worth
 * nothing are dropped rather than drawn as zero-width wedges, and a total of
 * nothing yields no slices at all — an empty ring says "no data" more honestly
 * than a full one in the first palette colour.
 */
export const buildDonutSlices = <T>(
  items: T[],
  valueOf: (item: T) => number,
  geometry: DonutGeometry = DEFAULT_DONUT,
): DonutSlice<T>[] => {
  const weighted = items
    .map((item) => ({ item, value: valueOf(item) }))
    .filter((entry) => entry.value > 0);

  const total = weighted.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return [];

  let accumulated = 0;
  return weighted.map((entry, index) => {
    const fraction = entry.value / total;
    const path = donutSegmentPath(accumulated, fraction, geometry);
    accumulated += fraction;
    return { item: entry.item, fraction, path, color: donutColor(index) };
  });
};
