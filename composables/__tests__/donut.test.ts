import { describe, expect, it } from "vitest";
import {
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
