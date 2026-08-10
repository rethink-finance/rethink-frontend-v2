import { describe, expect, it } from "vitest";
import { buildMonthlyReturns } from "../monthlyReturns";

const at = (iso: string) => Date.parse(iso);
const observation = (iso: string, sharePrice: number | null) => ({
  timestamp: at(iso),
  sharePrice,
});

/** "2025-03" -> percent, for readable assertions. */
const asMap = (returns: ReturnType<typeof buildMonthlyReturns>) =>
  Object.fromEntries(
    returns.map((r) => [
      `${r.year}-${String(r.month).padStart(2, "0")}`,
      Number(r.percent.toFixed(4)),
    ]),
  );

describe("buildMonthlyReturns", () => {
  it("measures each month from the previous month's closing price", () => {
    const returns = buildMonthlyReturns([
      observation("2025-01-10T00:00:00Z", 100),
      observation("2025-01-28T00:00:00Z", 110),
      observation("2025-02-27T00:00:00Z", 99),
    ]);

    expect(asMap(returns)).toEqual({
      // Opens at its own first price, there being nothing earlier.
      "2025-01": 10,
      // 99 against January's close of 110, not against January's open.
      "2025-02": -10,
    });
  });

  it("loses no movement: compounding the months reproduces the whole series", () => {
    const returns = buildMonthlyReturns([
      observation("2025-01-05T00:00:00Z", 100),
      observation("2025-01-20T00:00:00Z", 123),
      observation("2025-02-11T00:00:00Z", 97),
      observation("2025-05-02T00:00:00Z", 141.5),
      observation("2025-06-30T00:00:00Z", 88.25),
    ]);

    const compounded = returns.reduce((acc, r) => acc * (1 + r.percent / 100), 1);
    expect(compounded).toBeCloseTo(88.25 / 100, 12);
  });

  it("omits months with no observation rather than calling them flat", () => {
    const returns = buildMonthlyReturns([
      observation("2025-01-05T00:00:00Z", 100),
      observation("2025-01-20T00:00:00Z", 110),
      // Nothing at all in February.
      observation("2025-03-20T00:00:00Z", 121),
    ]);

    expect(Object.keys(asMap(returns))).toEqual(["2025-01", "2025-03"]);
    // March carries the move since January's close, undivided.
    expect(asMap(returns)["2025-03"]).toBe(10);
  });

  it("ignores prices struck before the vault's first settlement", () => {
    const returns = buildMonthlyReturns(
      [observation("2025-03-01T00:00:00Z", 100)],
      [
        // Bootstrap noise: a price against a dust supply, months earlier.
        observation("2025-01-15T00:00:00Z", 5000),
        observation("2025-03-15T00:00:00Z", 105),
      ],
    );

    expect(asMap(returns)).toEqual({ "2025-03": 5 });
  });

  it("collapses repeated daily readings, which carry no new information", () => {
    const returns = buildMonthlyReturns(
      [observation("2025-01-01T00:00:00Z", 100)],
      [
        observation("2025-01-20T00:00:00Z", 120),
        // The daily job rewriting the same row for months on end.
        observation("2025-02-20T00:00:00Z", 120),
        observation("2025-03-20T00:00:00Z", 120),
      ],
    );

    // Only January moved; February and March were never valued afresh.
    expect(Object.keys(asMap(returns))).toEqual(["2025-01"]);
    expect(asMap(returns)["2025-01"]).toBe(20);
  });

  it("keeps a settlement that lands on the previous price", () => {
    const returns = buildMonthlyReturns([
      observation("2025-01-01T00:00:00Z", 100),
      observation("2025-02-01T00:00:00Z", 100),
    ]);

    expect(asMap(returns)).toEqual({ "2025-02": 0 });
  });

  it("prefers the settled price where a snapshot shares its timestamp", () => {
    const timestamp = at("2025-02-01T00:00:00Z");
    const returns = buildMonthlyReturns(
      [
        observation("2025-01-01T00:00:00Z", 100),
        { timestamp, sharePrice: 150 },
      ],
      [{ timestamp, sharePrice: 900 }],
    );

    expect(asMap(returns)).toEqual({ "2025-02": 50 });
  });

  it("skips prices the vault could not be valued at", () => {
    const returns = buildMonthlyReturns([
      observation("2025-01-01T00:00:00Z", 100),
      observation("2025-02-01T00:00:00Z", 0),
      observation("2025-02-15T00:00:00Z", null),
      observation("2025-03-01T00:00:00Z", 120),
    ]);

    expect(asMap(returns)).toEqual({ "2025-03": 20 });
  });

  it("returns nothing when there is not enough to measure", () => {
    expect(buildMonthlyReturns([])).toEqual([]);
    // A vault with no settlement has never been priced on-chain.
    expect(
      buildMonthlyReturns([], [observation("2025-01-01T00:00:00Z", 100)]),
    ).toEqual([]);
    // A single price is an anchor, not a return.
    expect(buildMonthlyReturns([observation("2025-01-01T00:00:00Z", 100)])).toEqual(
      [],
    );
  });

  it("falls back to NAV for a vault that never minted shares", () => {
    // Share price is nought all the way down: the vault divided by a supply of
    // zero, which is a missing denominator rather than a total loss.
    const returns = buildMonthlyReturns([
      { timestamp: at("2025-01-10T00:00:00Z"), sharePrice: 0, totalNav: 1_000n },
      { timestamp: at("2025-01-28T00:00:00Z"), sharePrice: 0, totalNav: 1_100n },
      { timestamp: at("2025-02-27T00:00:00Z"), sharePrice: 0, totalNav: 990n },
    ]);

    // Identical to the share price case, the share count having cancelled.
    expect(asMap(returns)).toEqual({ "2025-01": 10, "2025-02": -10 });
    // Flagged, so a caller does not label a NAV as a price.
    expect(returns.every((r) => r.basis === "nav")).toBe(true);
  });

  it("prefers share price wherever the vault has one", () => {
    const returns = buildMonthlyReturns([
      { timestamp: at("2025-01-10T00:00:00Z"), sharePrice: 100, totalNav: 1_000n },
      // NAV doubled on a deposit; the share price barely moved, and it is the
      // share price that describes what a holder earned.
      { timestamp: at("2025-02-10T00:00:00Z"), sharePrice: 101, totalNav: 2_000n },
    ]);

    expect(asMap(returns)).toEqual({ "2025-02": 1 });
    expect(returns.every((r) => r.basis === "sharePrice")).toBe(true);
  });

  it("needs two share prices before it trusts them over NAV", () => {
    // ShineDAO's shape: priced only once, on the last reading.
    const returns = buildMonthlyReturns([
      { timestamp: at("2025-01-10T00:00:00Z"), sharePrice: 0, totalNav: 1_000n },
      { timestamp: at("2025-02-10T00:00:00Z"), sharePrice: 0, totalNav: 1_200n },
      { timestamp: at("2025-03-10T00:00:00Z"), sharePrice: 0.64, totalNav: 900n },
    ]);

    // A single price cannot be measured against anything, so all three months
    // come off NAV rather than one month coming off a lone price.
    expect(asMap(returns)).toEqual({ "2025-02": 20, "2025-03": -25 });
  });

  it("keeps measuring from NAV once a repaired feed prices the last few days", () => {
    // What actually happened to ShineDAO: the backend learned to price a
    // zero-supply vault and fixed the newest rows, leaving the history at
    // nought. Two good prices are not two years of them.
    const returns = buildMonthlyReturns([
      { timestamp: at("2025-01-10T00:00:00Z"), sharePrice: 0, totalNav: 1_000n, totalSupply: 0n },
      { timestamp: at("2025-02-10T00:00:00Z"), sharePrice: 0, totalNav: 1_200n, totalSupply: 0n },
      { timestamp: at("2025-03-10T00:00:00Z"), sharePrice: 0.64, totalNav: 900n, totalSupply: 0n },
      { timestamp: at("2025-03-11T00:00:00Z"), sharePrice: 0.66, totalNav: 928n, totalSupply: 0n },
    ]);

    // Every month, off NAV — not a lone March measured off the two new prices.
    expect(asMap(returns)).toEqual({ "2025-02": 20, "2025-03": -22.6667 });
    expect(returns.every((r) => r.basis === "nav")).toBe(true);
  });

  it("will not stand NAV in for a vault whose share count moved", () => {
    const returns = buildMonthlyReturns([
      { timestamp: at("2025-01-10T00:00:00Z"), sharePrice: 0, totalNav: 1_000n, totalSupply: 10n },
      { timestamp: at("2025-02-10T00:00:00Z"), sharePrice: 100, totalNav: 1_200n, totalSupply: 12n },
      { timestamp: at("2025-03-10T00:00:00Z"), sharePrice: 110, totalNav: 2_200n, totalSupply: 20n },
    ]);

    // NAV nearly doubled on deposits; the holder earned 10%.
    expect(asMap(returns)).toEqual({ "2025-03": 10 });
    expect(returns.every((r) => r.basis === "sharePrice")).toBe(true);
  });

  it("prefers a constant-supply vault's own prices where it has them all", () => {
    const returns = buildMonthlyReturns([
      { timestamp: at("2025-01-10T00:00:00Z"), sharePrice: 100, totalNav: 1_000n, totalSupply: 10n },
      { timestamp: at("2025-02-10T00:00:00Z"), sharePrice: 110, totalNav: 1_100n, totalSupply: 10n },
    ]);

    expect(returns.every((r) => r.basis === "sharePrice")).toBe(true);
  });

  it("buckets by UTC so a month boundary does not move with the reader", () => {
    const returns = buildMonthlyReturns([
      observation("2025-01-15T00:00:00Z", 100),
      // 23:30 UTC on the 31st is still January, wherever it is read.
      observation("2025-01-31T23:30:00Z", 110),
      observation("2025-02-01T00:30:00Z", 121),
    ]);

    expect(asMap(returns)).toEqual({ "2025-01": 10, "2025-02": 10 });
  });
});
