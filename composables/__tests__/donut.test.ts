import { describe, expect, it } from "vitest";
import {
  DEFAULT_DONUT,
  DONUT_COLORS,
  buildDonutSlices,
  donutColor,
  donutSegmentPath,
} from "../donut";

/** Every coordinate in a path, so a shape can be checked without matching text. */
const coordsOf = (path: string) =>
  (path.match(/-?\d+\.?\d*/g) ?? []).map(Number);

describe("donutSegmentPath", () => {
  it("starts a slice at twelve o'clock", () => {
    const path = donutSegmentPath(0, 0.25);
    // First move is the outer radius straight up from the centre: 100, 100-87.
    expect(path.startsWith("M 100.000 13.000")).toBe(true);
  });

  it("takes the long way round for a slice past the half", () => {
    expect(donutSegmentPath(0, 0.6)).toContain("0 1 1");
    expect(donutSegmentPath(0, 0.4)).toContain("0 0 1");
  });

  it("draws a whole circle as a ring rather than a hairline wedge", () => {
    // An arc from a point back to itself is degenerate — SVG draws nothing. A
    // position that is the entire vault has to become two full circles.
    const ring = donutSegmentPath(0, 1);
    expect(ring.match(/A /g)).toHaveLength(4);
    expect(ring.match(/M /g)).toHaveLength(2);
  });

  it("stays inside its viewBox", () => {
    const coords = coordsOf(donutSegmentPath(0.3, 0.45));
    for (const value of coords) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(200);
    }
  });

  it("honours a caller's own geometry", () => {
    const path = donutSegmentPath(0, 0.25, {
      center: 50,
      radiusOuter: 40,
      radiusInner: 20,
    });
    expect(path.startsWith("M 50.000 10.000")).toBe(true);
  });
});

describe("buildDonutSlices", () => {
  const value = (n: number) => n;

  it("splits the circle in proportion, in the order given", () => {
    const slices = buildDonutSlices([50, 30, 20], value);

    expect(slices.map((s) => s.fraction)).toEqual([0.5, 0.3, 0.2]);
    expect(slices.map((s) => s.color)).toEqual(DONUT_COLORS.slice(0, 3));
  });

  it("leaves no gap: the fractions close the circle", () => {
    const slices = buildDonutSlices([7, 3, 11, 1], value);
    const total = slices.reduce((sum, s) => sum + s.fraction, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it("drops items worth nothing rather than drawing empty wedges", () => {
    const slices = buildDonutSlices([10, 0, 5, -2], value);
    expect(slices.map((s) => s.item)).toEqual([10, 5]);
  });

  it("draws nothing at all when there is nothing to divide", () => {
    expect(buildDonutSlices([], value)).toEqual([]);
    expect(buildDonutSlices([0, 0], value)).toEqual([]);
  });

  it("gives a lone position the closed ring", () => {
    const [slice] = buildDonutSlices([42], value);
    expect(slice.fraction).toBe(1);
    expect(slice.path.match(/M /g)).toHaveLength(2);
  });

  it("cycles the palette rather than running out of colours", () => {
    expect(donutColor(0)).toBe(DONUT_COLORS[0]);
    expect(donutColor(DONUT_COLORS.length)).toBe(DONUT_COLORS[0]);
    expect(donutColor(DONUT_COLORS.length + 2)).toBe(DONUT_COLORS[2]);
  });
});

/** Where a slice's outer arc begins and ends — the first two coordinate pairs. */
const outerEnds = (path: string) => {
  const [x0, y0, , , , , , x1, y1] = coordsOf(path);
  return { start: [x0, y0], end: [x1, y1] };
};

/** Angle of a point about the donut's centre. */
const angleOf = ([x, y]: number[]) =>
  Math.atan2(y - DEFAULT_DONUT.center, x - DEFAULT_DONUT.center);

/**
 * Path coordinates are written to three decimals, which at radius 87 puts the
 * finest angle the format can express at ~1e-5 rad. Angles read back out of a
 * path are compared to that, not to the maths.
 */
const ANGLE_PRECISION = 4;

describe("donutSegmentPath gaps", () => {
  const gapped = (gap: number) => ({ ...DEFAULT_DONUT, gap });

  it("draws slices flush by default, so existing rings are unchanged", () => {
    // Two halves with no gap: one slice ends exactly where the next begins.
    const first = outerEnds(donutSegmentPath(0, 0.5));
    const second = outerEnds(donutSegmentPath(0.5, 0.5));
    expect(first.end).toEqual(second.start);
  });

  it("opens each seam by exactly one gap", () => {
    const gap = 0.05;
    const first = outerEnds(donutSegmentPath(0, 0.5, gapped(gap)));
    const second = outerEnds(donutSegmentPath(0.5, 0.5, gapped(gap)));
    expect(angleOf(second.start) - angleOf(first.end)).toBeCloseTo(
      gap,
      ANGLE_PRECISION,
    );
  });

  it("takes the gap off the slice, not off the ring", () => {
    // Half a gap comes off each end, so a slice loses one gap in total and the
    // ring still closes: the gaps are between slices, not extra empty space.
    const gap = 0.04;
    const { start, end } = outerEnds(donutSegmentPath(0.25, 0.25, gapped(gap)));
    expect(angleOf(end) - angleOf(start)).toBeCloseTo(
      0.25 * Math.PI * 2 - gap,
      ANGLE_PRECISION,
    );
  });

  it("still gives a lone position the closed ring", () => {
    // Nothing to be separated from, so the gap has no one to make room for.
    const ring = donutSegmentPath(0, 1, gapped(0.05));
    expect(ring.match(/M /g)).toHaveLength(2);
  });

  it("keeps a hairline for a slice narrower than the gap", () => {
    // Without a floor the end angle falls behind the start and the wedge is
    // drawn inside out — a spike straight across the ring.
    const { start, end } = outerEnds(donutSegmentPath(0.5, 0.0001, gapped(0.05)));
    const swept = angleOf(end) - angleOf(start);
    expect(swept).toBeGreaterThan(0);
    expect(swept).toBeLessThan(0.05);
  });

  it("measures the long-way-round flag on what is drawn", () => {
    // A hair over half the circle is under it again once the gaps come off,
    // and an arc flagged the long way round there sweeps the wrong side.
    expect(donutSegmentPath(0, 0.5001, gapped(0.05))).toContain("0 0 1");
    expect(donutSegmentPath(0, 0.5001)).toContain("0 1 1");
  });
});
