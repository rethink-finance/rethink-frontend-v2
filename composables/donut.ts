/**
 * Donut geometry, shared by every "what is this made of" chart in the app —
 * the vault's composition and the portfolio's allocation.
 *
 * Segments are real arc paths rather than a dashed circle stroke. A dashed
 * stroke draws a sub-percent slice as a skewed wedge wherever the dash wraps
 * the circle's seam, which is exactly the case a portfolio with one dominant
 * position hits.
 */

/**
 * Design's slice palette, in the order slices are drawn — callers sort rows by
 * size, so a colour's index is also where it sits on the ring.
 *
 * Order is not brightness. #2c8bff and #1f5fff are ten degrees of hue apart at
 * the same saturation: drawn side by side they read as one wedge rather than
 * two holdings, which is what the second and third slice of every vault used
 * to be. They are kept four apart in the cycle instead, so no two neighbours —
 * including the last slice against the first — share a hue family.
 */
export const DONUT_COLORS = [
  // var() references into tokens.scss, so the slices deepen on the light
  // theme without either card knowing. Consumers must paint them through a
  // style binding (`:style="{ fill: … }"`), never an SVG fill attribute —
  // var() does not resolve in presentation attributes.
  "var(--donut-1)",
  "var(--donut-2)",
  "var(--donut-3)",
  "var(--donut-4)",
  "var(--donut-5)",
  "var(--donut-6)",
];

/**
 * Held back for a slice that stands for everything not drawn — the muted one,
 * so a fold of small positions never outranks a real holding by colour. It is
 * also the palette's last entry, which is where such a slice lands today;
 * naming it separately keeps that true if the slice count ever changes.
 */
export const DONUT_OTHER_COLOR = "var(--donut-6)";

/** Colour for the nth slice, cycling once the palette runs out. */
export const donutColor = (index: number) =>
  DONUT_COLORS[index % DONUT_COLORS.length];

export interface DonutGeometry {
  /** Centre of the square viewBox. */
  center: number;
  radiusOuter: number;
  radiusInner: number;
  /**
   * Angular gap cut between neighbouring slices, in radians. Zero — the
   * default — draws them flush, as one continuous ring.
   */
  gap?: number;
}

/** The 200x200 viewBox both cards draw in. */
export const DEFAULT_DONUT: DonutGeometry = {
  center: 100,
  radiusOuter: 87,
  radiusInner: 53,
};

const TAU = Math.PI * 2;

/**
 * A slice narrower than this is drawn at this width anyway. Dust positions are
 * a real part of what a vault holds, and the alternative, once a gap wider
 * than the slice is cut out of it, is a wedge drawn inside out.
 */
const MIN_SWEEP = 0.008;

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

  const { radiusOuter, radiusInner, gap = 0 } = geometry;

  // Every boundary on a ring is shared with a neighbour, so each slice gives up
  // half a gap at either end and the ring still closes.
  let from = start * TAU - Math.PI / 2 + gap / 2;
  let to = (start + fraction) * TAU - Math.PI / 2 - gap / 2;

  // A position too small to survive the gap keeps a hairline, centred where it
  // actually sits rather than shunted to one side of it.
  if (to - from < MIN_SWEEP) {
    const middle = (start + fraction / 2) * TAU - Math.PI / 2;
    from = middle - MIN_SWEEP / 2;
    to = middle + MIN_SWEEP / 2;
  }

  // Measured on what is drawn, not on the slice's share: a hair over half the
  // circle is under it again once the gaps come off.
  const largeArc = to - from > Math.PI ? 1 : 0;

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
