import { describe, expect, it } from "vitest";
import { applyFigures, inheritFigures } from "../store/funds/liveFigures";
import type IFund from "../types/fund";

/** A discover row with only what the helpers look at. */
const row = (overrides: Partial<IFund>): IFund =>
  ({ address: "0xAbC", isNavUpdatesLoading: true, ...overrides }) as IFund;

/** What a backend snapshot leaves on a row. */
const figures: Partial<IFund> = {
  totalSimulatedNav: 100n,
  totalSimulatedNavUSD: "100.00",
  cumulativeReturnPercent: 0.25,
  sharePrice: 1.25,
  isNavUpdatesLoading: false,
};

describe("inheritFigures", () => {
  it("carries a predecessor's figures onto the fresh row", () => {
    const fresh = row({ title: "Renamed vault" });

    const [result] = inheritFigures([fresh], [row(figures)]);

    expect(result).toBe(fresh);
    expect(result.title).toBe("Renamed vault");
    expect(result.totalSimulatedNav).toBe(100n);
    expect(result.totalSimulatedNavUSD).toBe("100.00");
    expect(result.cumulativeReturnPercent).toBe(0.25);
    expect(result.isNavUpdatesLoading).toBe(false);
  });

  it("matches predecessors by address regardless of case", () => {
    const [result] = inheritFigures(
      [row({ address: "0xabc" })],
      [row({ address: "0xABC", ...figures })],
    );

    expect(result.totalSimulatedNavUSD).toBe("100.00");
  });

  it("leaves a row loading when its predecessor never got figures", () => {
    const [result] = inheritFigures(
      [row({})],
      [row({ totalSimulatedNavUSD: "stale", isNavUpdatesLoading: true })],
    );

    expect(result.isNavUpdatesLoading).toBe(true);
    expect(result.totalSimulatedNavUSD).toBeUndefined();
  });

  it("leaves a vault without a predecessor loading", () => {
    const [result] = inheritFigures([row({ address: "0xNEW" })], [row(figures)]);

    expect(result.isNavUpdatesLoading).toBe(true);
    expect(result.totalSimulatedNavUSD).toBeUndefined();
  });

  it("returns the fresh rows untouched without a previous set", () => {
    const fresh = [row({})];

    expect(inheritFigures(fresh, undefined)).toBe(fresh);
    expect(inheritFigures(fresh, [])).toBe(fresh);
    expect(fresh[0].isNavUpdatesLoading).toBe(true);
  });
});

describe("applyFigures", () => {
  it("writes fresh figures onto the rows on screen, in place", () => {
    const onScreen = row({
      totalSimulatedNavUSD: "90.00",
      isNavUpdatesLoading: false,
    });

    applyFigures([onScreen], [row(figures)]);

    expect(onScreen.totalSimulatedNavUSD).toBe("100.00");
    expect(onScreen.sharePrice).toBe(1.25);
    expect(onScreen.isNavUpdatesLoading).toBe(false);
  });

  it("leaves rows the source does not know alone", () => {
    const onScreen = row({
      address: "0xOTHER",
      totalSimulatedNavUSD: "90.00",
      isNavUpdatesLoading: false,
    });

    applyFigures([onScreen], [row(figures)]);

    expect(onScreen.totalSimulatedNavUSD).toBe("90.00");
  });

  it("clears figures the backend no longer has, so the cell reads N/A", () => {
    const onScreen = row({
      totalSimulatedNavUSD: "90.00",
      isNavUpdatesLoading: false,
    });

    applyFigures(
      [onScreen],
      [row({ totalSimulatedNav: 0n, isNavUpdatesLoading: false })],
    );

    expect(onScreen.totalSimulatedNavUSD).toBeUndefined();
    expect(onScreen.totalSimulatedNav).toBe(0n);
    expect(onScreen.isNavUpdatesLoading).toBe(false);
  });

  it("does nothing without rows", () => {
    expect(() => applyFigures(undefined, [row(figures)])).not.toThrow();
    expect(() => applyFigures([], [row(figures)])).not.toThrow();
  });
});
