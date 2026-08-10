import { describe, expect, it } from "vitest";
import {
  buildShareBalanceHistory,
  buildVaultValueSeries,
  buildWeightedReturnSeries,
  calibrateToPosition,
  priceAt,
  sharesAt,
  sumValueSeries,
} from "../portfolioSeries";
import { availableRanges, pointsInRange, resolveEffectiveRange } from "../chartRanges";

const at = (iso: string) => Date.parse(iso);
const price = (iso: string, value: number) => ({
  timestamp: at(iso),
  price: value,
});
const delta = (iso: string, shares: number) => ({
  timestamp: at(iso),
  shares,
});

describe("buildShareBalanceHistory", () => {
  it("walks back from today's balance, which stays exact", () => {
    // Deposited 100, then 50 more; holds 150 today.
    const history = buildShareBalanceHistory(150, [
      delta("2025-01-10T00:00:00Z", 100),
      delta("2025-03-10T00:00:00Z", 50),
    ]);

    expect(history.openingShares).toBe(0);
    expect(history.isComplete).toBe(true);
    expect(sharesAt(history, at("2025-01-01T00:00:00Z"))).toBe(0);
    expect(sharesAt(history, at("2025-02-01T00:00:00Z"))).toBe(100);
    expect(sharesAt(history, at("2025-04-01T00:00:00Z"))).toBe(150);
  });

  it("holds the balance from the moment of the flow, not the day after", () => {
    const history = buildShareBalanceHistory(100, [
      delta("2025-01-10T00:00:00Z", 100),
    ]);

    expect(sharesAt(history, at("2025-01-09T23:59:59Z"))).toBe(0);
    expect(sharesAt(history, at("2025-01-10T00:00:00Z"))).toBe(100);
  });

  it("subtracts a redemption walking back", () => {
    // Deposited 200, redeemed 80, holds 120.
    const history = buildShareBalanceHistory(120, [
      delta("2025-01-10T00:00:00Z", 200),
      delta("2025-06-10T00:00:00Z", -80),
    ]);

    expect(sharesAt(history, at("2025-03-01T00:00:00Z"))).toBe(200);
    expect(sharesAt(history, at("2025-07-01T00:00:00Z"))).toBe(120);
    expect(history.isComplete).toBe(true);
  });

  it("reads flows in time order however they arrive", () => {
    const history = buildShareBalanceHistory(150, [
      delta("2025-03-10T00:00:00Z", 50),
      delta("2025-01-10T00:00:00Z", 100),
    ]);

    expect(sharesAt(history, at("2025-02-01T00:00:00Z"))).toBe(100);
    expect(history.isComplete).toBe(true);
  });

  it("flags a history that cannot account for what is held", () => {
    // Holds 150 but only one 100-share deposit is on record: 50 arrived some
    // other way, so the early end of the line is a floor, not a measurement.
    const history = buildShareBalanceHistory(150, [
      delta("2025-01-10T00:00:00Z", 100),
    ]);

    expect(history.isComplete).toBe(false);
    expect(history.openingShares).toBe(50);
    // Today is still exact — that is the point of walking backwards.
    expect(sharesAt(history, at("2025-06-01T00:00:00Z"))).toBe(150);
  });

  it("never reports a negative balance", () => {
    const history = buildShareBalanceHistory(10, [
      delta("2025-01-10T00:00:00Z", 500),
    ]);

    expect(history.openingShares).toBe(0);
    expect(history.isComplete).toBe(false);
    expect(sharesAt(history, at("2024-01-01T00:00:00Z"))).toBe(0);
  });

  it("holds a flowless wallet at its current balance throughout", () => {
    const history = buildShareBalanceHistory(75, []);
    expect(sharesAt(history, at("2020-01-01T00:00:00Z"))).toBe(75);
    // Nothing explains the 75, so it is honest about being a guess.
    expect(history.isComplete).toBe(false);
  });
});

describe("buildVaultValueSeries", () => {
  it("prices the balance held at each reading", () => {
    const history = buildShareBalanceHistory(150, [
      delta("2025-01-10T00:00:00Z", 100),
      delta("2025-03-10T00:00:00Z", 50),
    ]);
    const series = buildVaultValueSeries(
      [
        price("2025-01-05T00:00:00Z", 2),
        price("2025-02-05T00:00:00Z", 2),
        price("2025-04-05T00:00:00Z", 3),
      ],
      history,
    );

    expect(series.map((p) => p.value)).toEqual([0, 200, 450]);
  });

  it("separates a deposit from a gain", () => {
    // The balance doubles and the price does not: the line steps, but the
    // return over the window has to stay flat.
    const history = buildShareBalanceHistory(200, [
      delta("2025-01-01T00:00:00Z", 100),
      delta("2025-02-01T00:00:00Z", 100),
    ]);
    const series = buildVaultValueSeries(
      [price("2025-01-15T00:00:00Z", 5), price("2025-02-15T00:00:00Z", 5)],
      history,
    );

    expect(series.map((p) => p.value)).toEqual([500, 1000]);
  });
});

describe("sumValueSeries", () => {
  it("adds vaults priced on different days by carrying each forward", () => {
    const a = [
      { timestamp: at("2025-01-01T00:00:00Z"), value: 100 },
      { timestamp: at("2025-01-03T00:00:00Z"), value: 120 },
    ];
    const b = [{ timestamp: at("2025-01-02T00:00:00Z"), value: 50 }];

    expect(sumValueSeries([a, b])).toEqual([
      { timestamp: at("2025-01-01T00:00:00Z"), value: 100 },
      // b joins on the 2nd; a is carried at 100.
      { timestamp: at("2025-01-02T00:00:00Z"), value: 150 },
      // a moves on the 3rd; b is carried at 50.
      { timestamp: at("2025-01-03T00:00:00Z"), value: 170 },
    ]);
  });

  it("counts a vault as nothing before its first reading", () => {
    const a = [{ timestamp: at("2025-01-01T00:00:00Z"), value: 100 }];
    const b = [{ timestamp: at("2025-06-01T00:00:00Z"), value: 40 }];

    const summed = sumValueSeries([a, b]);
    expect(summed[0].value).toBe(100);
    expect(summed[1].value).toBe(140);
  });

  it("keeps a stale vault at its last known value", () => {
    const a = [
      { timestamp: at("2025-01-01T00:00:00Z"), value: 10 },
      { timestamp: at("2025-09-01T00:00:00Z"), value: 10 },
    ];
    const b = [{ timestamp: at("2025-02-01T00:00:00Z"), value: 90 }];

    expect(sumValueSeries([a, b]).at(-1)).toEqual({
      timestamp: at("2025-09-01T00:00:00Z"),
      value: 100,
    });
  });

  it("returns nothing when no vault has a series", () => {
    expect(sumValueSeries([])).toEqual([]);
    expect(sumValueSeries([[], []])).toEqual([]);
  });
});

describe("buildWeightedReturnSeries", () => {
  const percents = (points: ReturnType<typeof buildWeightedReturnSeries>) =>
    points.map((point) => Number(point.value.toFixed(6)));

  it("opens at zero and follows a lone vault's price", () => {
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 100 },
          { timestamp: 2, value: 110 },
        ],
        prices: [
          { timestamp: 1, price: 10 },
          { timestamp: 2, price: 11 },
        ],
      },
    ]);

    expect(percents(series)).toEqual([0, 10]);
  });

  it("ignores a deposit, which is money paid in rather than earned", () => {
    // The value doubles while the price stands still.
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 100 },
          { timestamp: 2, value: 200 },
        ],
        prices: [
          { timestamp: 1, price: 10 },
          { timestamp: 2, price: 10 },
        ],
      },
    ]);

    expect(percents(series)).toEqual([0, 0]);
  });

  it("ignores a withdrawal too", () => {
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 100 },
          { timestamp: 2, value: 20 },
        ],
        prices: [
          { timestamp: 1, price: 10 },
          { timestamp: 2, price: 10 },
        ],
      },
    ]);

    expect(percents(series)).toEqual([0, 0]);
  });

  it("does not read a vault joining the series as a gain", () => {
    // The second vault has no earlier price, so the total leaps — which looks
    // exactly like a deposit and is just as much not a return.
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 100 },
          { timestamp: 2, value: 100 },
        ],
        prices: [
          { timestamp: 1, price: 5 },
          { timestamp: 2, price: 5 },
        ],
      },
      {
        values: [{ timestamp: 2, value: 5000 }],
        prices: [{ timestamp: 2, price: 50 }],
      },
    ]);

    expect(percents(series)).toEqual([0, 0]);
  });

  it("weights each vault by what was in it at the start of the period", () => {
    // 300 flat, 100 up 20%: the portfolio earned 5%.
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 300 },
          { timestamp: 2, value: 300 },
        ],
        prices: [
          { timestamp: 1, price: 3 },
          { timestamp: 2, price: 3 },
        ],
      },
      {
        values: [
          { timestamp: 1, value: 100 },
          { timestamp: 2, value: 120 },
        ],
        prices: [
          { timestamp: 1, price: 10 },
          { timestamp: 2, price: 12 },
        ],
      },
    ]);

    expect(percents(series)).toEqual([0, 5]);
  });

  it("compounds across periods rather than adding them", () => {
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 100 },
          { timestamp: 2, value: 110 },
          { timestamp: 3, value: 121 },
        ],
        prices: [
          { timestamp: 1, price: 10 },
          { timestamp: 2, price: 11 },
          { timestamp: 3, price: 12.1 },
        ],
      },
    ]);

    // 10% then 10% is 21%, not 20%.
    expect(percents(series)).toEqual([0, 10, 21]);
  });

  it("holds flat across a period where nothing was held", () => {
    const series = buildWeightedReturnSeries([
      {
        values: [
          { timestamp: 1, value: 0 },
          { timestamp: 2, value: 0 },
          { timestamp: 3, value: 100 },
          { timestamp: 4, value: 150 },
        ],
        prices: [
          { timestamp: 1, price: 10 },
          { timestamp: 2, price: 40 },
          { timestamp: 3, price: 10 },
          { timestamp: 4, price: 15 },
        ],
      },
    ]);

    // The vault's price moved before the wallet was in it; only the last
    // period counts.
    expect(percents(series)).toEqual([0, 0, 0, 50]);
  });

  it("has nothing to measure from a single point", () => {
    expect(buildWeightedReturnSeries([])).toEqual([]);
    expect(
      buildWeightedReturnSeries([
        { values: [{ timestamp: 1, value: 10 }], prices: [{ timestamp: 1, price: 1 }] },
      ]),
    ).toEqual([]);
  });
});

describe("priceAt", () => {
  const prices = [
    price("2025-01-01T00:00:00Z", 10),
    price("2025-02-01T00:00:00Z", 12),
    price("2025-03-01T00:00:00Z", 9),
  ];

  it("takes the last reading at or before the moment", () => {
    expect(priceAt(prices, at("2025-02-15T00:00:00Z"))).toBe(12);
    expect(priceAt(prices, at("2025-02-01T00:00:00Z"))).toBe(12);
    expect(priceAt(prices, at("2025-09-01T00:00:00Z"))).toBe(9);
  });

  it("falls forward to the first reading for a moment before them all", () => {
    // A deposit predating the backend's records. Pricing it at the earliest
    // reading beats dropping the deposit and understating what was paid in.
    expect(priceAt(prices, at("2024-06-01T00:00:00Z"))).toBe(10);
  });

  it("has no answer without readings", () => {
    expect(priceAt([], 0)).toBeUndefined();
  });
});

describe("calibrateToPosition", () => {
  it("rescales an arbitrary series onto the wallet's own units", () => {
    // The backend prices this vault in the millions; the wallet holds 200
    // shares worth 400 of the base asset, so a share is really worth 2.
    const calibrated = calibrateToPosition(
      [
        price("2025-01-01T00:00:00Z", 1_000_000),
        price("2025-02-01T00:00:00Z", 2_000_000),
      ],
      200,
      400,
    );

    expect(calibrated.map((p) => p.price)).toEqual([1, 2]);
  });

  it("reproduces today's position exactly", () => {
    const shares = 137.5;
    const value = 913.42;
    const calibrated = calibrateToPosition(
      [price("2025-01-01T00:00:00Z", 3), price("2025-06-01T00:00:00Z", 7)],
      shares,
      value,
    );

    expect(calibrated.at(-1)!.price * shares).toBeCloseTo(value, 10);
  });

  it("works off a series that is not a price at all", () => {
    // A vault that never minted shares is tracked by its NAV. Only the shape
    // matters, since the wallet's position supplies the scale.
    const calibrated = calibrateToPosition(
      [price("2025-01-01T00:00:00Z", 1e24), price("2025-02-01T00:00:00Z", 1.1e24)],
      10,
      110,
    );

    expect(calibrated.map((p) => Number(p.price.toFixed(6)))).toEqual([10, 11]);
  });

  it("orders the series before calibrating on its latest reading", () => {
    const calibrated = calibrateToPosition(
      [price("2025-06-01T00:00:00Z", 4), price("2025-01-01T00:00:00Z", 2)],
      10,
      40,
    );

    expect(calibrated.map((p) => p.price)).toEqual([2, 4]);
  });

  it("refuses to calibrate with nothing to calibrate against", () => {
    expect(calibrateToPosition([], 10, 40)).toEqual([]);
    expect(calibrateToPosition([price("2025-01-01T00:00:00Z", 4)], 0, 40)).toEqual([]);
    expect(calibrateToPosition([price("2025-01-01T00:00:00Z", 4)], 10, 0)).toEqual([]);
    expect(calibrateToPosition([price("2025-01-01T00:00:00Z", 0)], 10, 40)).toEqual([]);
  });
});

describe("chart ranges", () => {
  const now = at("2025-06-30T00:00:00Z");
  const points = [
    { timestamp: at("2024-01-01T00:00:00Z") },
    { timestamp: at("2025-06-01T00:00:00Z") },
    { timestamp: at("2025-06-20T00:00:00Z") },
  ];

  it("keeps only what falls inside the window", () => {
    expect(pointsInRange(points, "1M", now)).toHaveLength(2);
    expect(pointsInRange(points, "ALL", now)).toHaveLength(3);
  });

  it("refuses a window holding a single point", () => {
    const sparse = [{ timestamp: at("2024-01-01T00:00:00Z") }, { timestamp: now }];
    expect(pointsInRange(sparse, "1M", now)).toBeNull();
    expect(pointsInRange(sparse, "1Y", now)).toBeNull();
    expect(pointsInRange(sparse, "ALL", now)).toHaveLength(2);
  });

  it("falls back to the narrowest range that can be drawn", () => {
    const sparse = [{ timestamp: at("2024-01-01T00:00:00Z") }, { timestamp: now }];
    const available = availableRanges(sparse, now);

    expect([...available]).toEqual(["ALL"]);
    expect(resolveEffectiveRange("1M", available)).toBe("ALL");
    // A selection that can be drawn is left alone.
    expect(resolveEffectiveRange("ALL", available)).toBe("ALL");
  });
});
