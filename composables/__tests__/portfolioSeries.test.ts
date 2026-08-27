import { describe, expect, it } from "vitest";
import {
  buildShareBalanceHistory,
  buildVaultValueSeries,
  buildWeightedReturnSeries,
  calibrateToPosition,
  measureFlows,
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

describe("measureFlows", () => {
  // Whole-unit tokens keep the arithmetic readable; the decimals-bridging
  // cases are covered by the CarrotFunding figures at the end.
  const flow = (iso: string, name: string, amount: bigint | null) => ({
    name,
    resolvedAmount: amount,
    timestamp: at(iso),
  });

  it("measures a position bought inside the series at its cash cost", () => {
    const prices = [
      price("2025-01-01T00:00:00Z", 1),
      price("2025-06-01T00:00:00Z", 1.25),
    ];
    const { netInvested, measurableCost, canMeasure, deltas } = measureFlows(
      [flow("2025-01-02T00:00:00Z", "deposit()", 100n)],
      prices,
      0,
      0,
      100,
    );

    expect(netInvested).toBe(100);
    expect(measurableCost).toBe(100);
    expect(canMeasure).toBe(true);
    expect(deltas).toEqual([delta("2025-01-02T00:00:00Z", 100)]);
  });

  it("counts a request and its settlement once, not twice", () => {
    const prices = [price("2025-01-01T00:00:00Z", 1)];
    const { netInvested, measurableCost } = measureFlows(
      [
        flow("2025-01-02T00:00:00Z", "requestDeposit(uint256)", 100n),
        flow("2025-01-03T00:00:00Z", "deposit()", 100n),
      ],
      prices,
      0,
      0,
      100,
    );

    expect(netInvested).toBe(100);
    expect(measurableCost).toBe(100);
  });

  it("nets a redemption out of both costs at the price it settled", () => {
    const prices = [
      price("2025-01-01T00:00:00Z", 1),
      price("2025-06-01T00:00:00Z", 2),
    ];
    const { netInvested, measurableCost } = measureFlows(
      [
        flow("2025-01-02T00:00:00Z", "deposit()", 100n),
        flow("2025-06-02T00:00:00Z", "withdraw()", 30n),
      ],
      prices,
      0,
      0,
      70,
    );

    expect(netInvested).toBe(100 - 30 * 2);
    expect(measurableCost).toBe(100 - 30 * 2);
  });

  it("books what predates the series at its opening price, cash notwithstanding", () => {
    // Bought for 100 during bootstrap, sold 30 shares during bootstrap too,
    // then 10 more inside the series. The cash figure keeps every leg — the
    // pre-series redemption at the opening price, there being nothing earlier —
    // while the return's cost refuses to reach past the series: 40 of the 45
    // shares held today predate it and are booked at the opening 2.0.
    const prices = [
      price("2025-06-01T00:00:00Z", 2),
      price("2025-09-01T00:00:00Z", 2.5),
    ];
    const { netInvested, measurableCost } = measureFlows(
      [
        flow("2025-01-02T00:00:00Z", "deposit()", 100n),
        flow("2025-02-02T00:00:00Z", "withdraw()", 30n),
        flow("2025-06-02T00:00:00Z", "deposit()", 10n),
      ],
      prices,
      0,
      0,
      45,
    );

    expect(netInvested).toBe(100 - 30 * 2 + 10);
    expect(measurableCost).toBe(40 * 2 + 10);
  });

  it("prices a holding the flows never explain at the series' opening", () => {
    // Shares that arrived by transfer: no flows at all, so no cash cost —
    // but the holding is still measurable from the first price onward.
    const prices = [
      price("2025-06-01T00:00:00Z", 2),
      price("2025-09-01T00:00:00Z", 3),
    ];
    const { netInvested, measurableCost } = measureFlows([], prices, 0, 0, 40);

    expect(netInvested).toBe(0);
    expect(measurableCost).toBe(80);
  });

  it("falls back to cash where the vault has never been priced", () => {
    const bought = measureFlows(
      [flow("2025-01-02T00:00:00Z", "deposit()", 100n)],
      [],
      0,
      0,
      100,
    );
    expect(bought.netInvested).toBe(100);
    expect(bought.measurableCost).toBe(100);
    expect(bought.canMeasure).toBe(true);

    // A redemption with no price cannot be netted out, poisoning both costs.
    const redeemed = measureFlows(
      [
        flow("2025-01-02T00:00:00Z", "deposit()", 100n),
        flow("2025-02-02T00:00:00Z", "withdraw()", 30n),
      ],
      [],
      0,
      0,
      70,
    );
    expect(redeemed.canMeasure).toBe(false);
    expect(redeemed.measurableCost).toBe(0);
  });

  it("goes non-positive where more was taken out than went in", () => {
    const prices = [
      price("2025-01-01T00:00:00Z", 1),
      price("2025-06-01T00:00:00Z", 3),
    ];
    const { netInvested, measurableCost } = measureFlows(
      [
        flow("2025-01-02T00:00:00Z", "deposit()", 100n),
        flow("2025-06-02T00:00:00Z", "withdraw()", 60n),
      ],
      prices,
      0,
      0,
      40,
    );

    expect(netInvested).toBeLessThanOrEqual(0);
    expect(measurableCost).toBeLessThanOrEqual(0);
  });

  it("keeps a bootstrap windfall out of the return's cost basis", () => {
    // CarrotFunding, HyperEVM, August 2026. The wallet's 1 USDC deposit
    // predates the vault's first settlement and was minted 2.7M raw units —
    // a first-depositor claim on the safe's seed balance that no price series
    // can cost. Against cash the position read +142%; booked at the series'
    // opening price it reads the vault's own +13.6% since that settlement.
    // Figures are the live ones: reader value 2.261756 USDC over 2,609,979
    // raw units (18 declared decimals), backend share prices as stored.
    const shares = 2.609979e-12;
    const value = 2.261756;
    const prices = calibrateToPosition(
      [
        price("2026-08-18T12:29:59Z", 1.0000931186047853),
        price("2026-08-24T23:51:00Z", 1.1362134292271264),
        price("2026-08-26T11:10:00Z", 1.1362706113008985),
      ],
      shares,
      value,
    );

    const { netInvested, measurableCost } = measureFlows(
      [
        flow("2026-08-03T17:54:54Z", "requestDeposit(uint256)", 1_000_000n),
        flow("2026-08-03T18:26:18Z", "deposit()", 1_000_000n),
        flow("2026-08-03T18:31:24Z", "requestWithdraw(uint256)", 100_000n),
        flow("2026-08-04T07:38:41Z", "withdraw()", 100_000n),
        flow("2026-08-18T15:15:19Z", "deposit()", 10_000n),
      ],
      prices,
      6,
      18,
      shares,
    );

    // Cash: 1 USDC in, ~0.076 out at the only price there is, 0.01 in.
    expect(netInvested).toBeCloseTo(0.9337, 4);
    // The old cost basis — the windfall against cash.
    expect((value / netInvested - 1) * 100).toBeCloseTo(142.23, 2);
    // The measurable one: the vault's performance since it first had a price.
    expect((value / measurableCost - 1) * 100).toBeCloseTo(13.62, 2);
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
