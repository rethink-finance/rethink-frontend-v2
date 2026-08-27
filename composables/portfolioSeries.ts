import { ethers } from "ethers";
import { resolveVaultOperation } from "~/composables/vaultOperations";

/**
 * What a wallet's holdings have been worth over time, and what they cost.
 *
 * The chain tells us what a wallet holds *now*; it keeps no history of that.
 * The subgraph records every deposit and redemption the wallet signed, and the
 * backend records what a share has been worth on every day since. Between them
 * a value series can be reconstructed: shares held at a moment, times the price
 * of a share at that moment.
 *
 * The reconstruction runs **backwards from today's balance**, not forwards from
 * zero. Today's balance is the one number we know exactly, and anchoring there
 * keeps the recent end of the line — the part anyone actually reads — exact,
 * pushing any error from a flow we never saw into the distant past instead of
 * shifting the whole line up or down.
 */

export interface PricePoint {
  timestamp: number;
  price: number;
}

/** A change in share count: positive where shares were minted, negative burned. */
export interface ShareDelta {
  timestamp: number;
  shares: number;
}

export interface ValuePoint {
  timestamp: number;
  value: number;
}

/** From this moment onward, until the next entry, the wallet held `shares`. */
export interface ShareBalancePoint {
  timestamp: number;
  shares: number;
}

export interface ShareBalanceHistory {
  /** Ascending, one entry per change. */
  points: ShareBalancePoint[];
  /** Held before the earliest entry — zero for a complete history. */
  openingShares: number;
  /**
   * False where the walk hit zero early, which means shares arrived by some
   * route the subgraph never saw: a transfer, or a chain whose deployment is
   * missing flows. The recent end of the series is still exact; the early end
   * is a floor rather than a measurement.
   */
  isComplete: boolean;
}

const byTimestamp = (a: { timestamp: number }, b: { timestamp: number }) =>
  a.timestamp - b.timestamp;

/**
 * The price in force at a moment: the most recent reading at or before it.
 *
 * Before the first reading there is nothing to look back to, so the first one
 * stands in. That only ever applies to a deposit made before the backend began
 * recording the vault, where the alternative is discarding the deposit
 * entirely.
 */
export const priceAt = (
  prices: PricePoint[],
  timestamp: number,
): number | undefined => {
  if (!prices.length) return undefined;

  let price: number | undefined;
  for (const point of prices) {
    if (point.timestamp > timestamp) break;
    price = point.price;
  }
  return price ?? prices[0].price;
};

/**
 * The backend reports a share price as NAV over supply, on a scale of its own
 * per vault — decimals are not divided out consistently, and a vault that never
 * minted shares is priced off its NAV instead. That is fine for a return, where
 * the scale cancels, and useless for a portfolio, where vaults have to be added
 * together in one unit.
 *
 * The wallet's own position supplies the missing constant: it holds a known
 * number of shares worth a known amount of the base asset right now, and the
 * series is proportional to the truth, so one division fixes the whole of it.
 * By construction the series then agrees exactly with the position the vault
 * page reports today.
 *
 * Returns nothing when there is no position to calibrate against — an
 * uncalibrated series would be summed against real ones as if it were money.
 */
export const calibrateToPosition = (
  prices: PricePoint[],
  currentShares: number,
  currentValue: number,
): PricePoint[] => {
  if (!prices.length || currentShares <= 0 || currentValue <= 0) return [];

  const sorted = [...prices].sort(byTimestamp);
  const latest = sorted[sorted.length - 1].price;
  if (!latest) return [];

  const scale = currentValue / currentShares / latest;
  return sorted.map((point) => ({
    timestamp: point.timestamp,
    price: point.price * scale,
  }));
};

// ---- What the flows say a position cost -------------------------------------

const toNumber = (value: bigint, decimals: number) =>
  parseFloat(ethers.formatUnits(value, decimals));

/** The slice of a flow the cost measurement reads, common to both feeds. */
export interface MeasurableFlow {
  /** Full signature, e.g. "requestDeposit(uint256)" — the operation table's key. */
  name: string;
  /** What actually moved — base asset for deposits, shares for redemptions. */
  resolvedAmount: bigint | null;
  timestamp: number;
}

export interface FlowMeasurement {
  /** Share movements behind the settled flows, for the balance history. */
  deltas: ShareDelta[];
  /** Paid in less taken out, in the base asset — the cash cost. */
  netInvested: number;
  /** False where a redemption could not be priced, poisoning netInvested. */
  canMeasure: boolean;
  /**
   * The cost the return is measured against. Zero or negative where nothing is
   * measurable, which the caller reads as "no figure".
   */
  measurableCost: number;
}

/**
 * What the wallet paid for its position, measured two ways.
 *
 * Only settled operations count either way. A request and the deposit it
 * becomes are two rows for one movement of money, so counting both would book
 * it twice. Deposits are recorded in the base asset and redemptions in shares,
 * so each redemption leg is converted through the price in force when it
 * settled.
 *
 * `netInvested` is cash: paid in less taken out, wherever in the vault's life
 * it moved. The headline's dollar figure measures against it, because money is
 * money however early it was paid.
 *
 * `measurableCost` is what the return column measures against, and it does not
 * reach past the vault's first recorded price. Nothing before that price was
 * transacted at a rate the series can describe — the series itself starts at
 * the first settlement for exactly that reason — and vaults issue bootstrap
 * shares at rates of their own: CarrotFunding minted its first depositor 2.7M
 * units for 1 USDC, a claim on the safe's seed balance that read as a +142%
 * "return" against cash. So whatever was already held when the series opens is
 * booked at the opening price — the first price that ever existed — and only
 * flows inside the series carry their cash. A position held through the series
 * thereby measures the vault's own performance, the same figure its details
 * page reports, and one bought entirely inside the series still measures its
 * cash cost, so the two figures agree wherever both can see.
 */
export const measureFlows = (
  flows: MeasurableFlow[],
  prices: PricePoint[],
  baseDecimals: number,
  shareDecimals: number,
  currentShares: number,
): FlowMeasurement => {
  const deltas: ShareDelta[] = [];
  let netInvested = 0;
  let canMeasure = true;

  const measurableFrom = prices[0]?.timestamp;
  let measurableCash = 0;
  let measuredDeltas = 0;

  for (const flow of [...flows].sort(byTimestamp)) {
    const operation = resolveVaultOperation(flow.name);
    if (!operation?.isSettled || flow.resolvedAmount == null) continue;

    const price = priceAt(prices, flow.timestamp);
    const isMeasurable =
      measurableFrom !== undefined && flow.timestamp >= measurableFrom;

    if (operation.family === "deposit") {
      // A deposit is recorded in the base asset, so what it cost is known
      // whether or not the vault has ever been priced. Only the shares it
      // bought need a price, and a vault with no price history — one that has
      // never settled — still has a cost worth reporting.
      const base = toNumber(flow.resolvedAmount, baseDecimals);
      netInvested += base;
      if (isMeasurable) measurableCash += base;
      if (price) {
        const shares = base / price;
        deltas.push({ timestamp: flow.timestamp, shares });
        if (isMeasurable) measuredDeltas += shares;
      }
    } else if (operation.family === "withdraw") {
      const shares = toNumber(flow.resolvedAmount, shareDecimals);
      deltas.push({ timestamp: flow.timestamp, shares: -shares });
      if (isMeasurable) measuredDeltas -= shares;
      // A redemption is recorded in shares, so without a price there is no
      // saying what left. Netting it at nothing would overstate the cost still
      // standing, and with it the return, so no figure is given at all.
      if (!price) canMeasure = false;
      else {
        netInvested -= shares * price;
        if (isMeasurable) measurableCash -= shares * price;
      }
    }
  }

  // Whatever the in-series flows cannot account for was already held when the
  // series opened — deposited during bootstrap, or transferred in — and is
  // booked at the opening price. With no series at all, cash is the only
  // measure there is.
  const measurableCost =
    measurableFrom === undefined
      ? canMeasure
        ? netInvested
        : 0
      : Math.max(0, currentShares - measuredDeltas) * prices[0].price +
        measurableCash;

  return { deltas, netInvested, canMeasure, measurableCost };
};

/**
 * The wallet's share balance over time, walked back from what it holds today.
 *
 * A balance can never be negative, so the walk floors at zero. Hitting the
 * floor before running out of deltas is the signal that the history is partial.
 */
export const buildShareBalanceHistory = (
  currentShares: number,
  deltas: ShareDelta[],
): ShareBalanceHistory => {
  const newestFirst = [...deltas].sort((a, b) => b.timestamp - a.timestamp);

  const points: ShareBalancePoint[] = [];
  let shares = currentShares;
  let isComplete = true;

  for (const delta of newestFirst) {
    // `shares` is what was held from this delta until the next one.
    points.push({ timestamp: delta.timestamp, shares });
    const before = shares - delta.shares;
    if (before < 0) isComplete = false;
    shares = Math.max(0, before);
  }

  return {
    points: points.reverse(),
    openingShares: shares,
    // Anything left over before the first flow is also unexplained.
    isComplete: isComplete && shares === 0,
  };
};

/** What the wallet held at a moment, per a history built above. */
export const sharesAt = (
  history: ShareBalanceHistory,
  timestamp: number,
): number => {
  let shares = history.openingShares;
  for (const point of history.points) {
    if (point.timestamp > timestamp) break;
    shares = point.shares;
  }
  return shares;
};

/**
 * One vault's contribution to the portfolio, sampled wherever it was priced.
 *
 * Deposits and redemptions land between price readings, so a step in the
 * balance shows up at the next reading rather than the moment it happened. The
 * backend prices vaults daily, which puts that lag inside a day.
 */
export const buildVaultValueSeries = (
  prices: PricePoint[],
  history: ShareBalanceHistory,
): ValuePoint[] =>
  [...prices]
    .sort(byTimestamp)
    .map((point) => ({
      timestamp: point.timestamp,
      value: sharesAt(history, point.timestamp) * point.price,
    }));

/**
 * Every vault's series added together on one time axis.
 *
 * Vaults are priced on their own schedules, so the axis is the union of all of
 * them and each vault carries its last known value forward across the gaps. A
 * vault contributes nothing before its first reading, which is right: the
 * wallet had not bought into it yet.
 */
export const sumValueSeries = (series: ValuePoint[][]): ValuePoint[] => {
  const sorted = series
    .filter((points) => points.length)
    .map((points) => [...points].sort(byTimestamp));
  if (!sorted.length) return [];

  const timestamps = [
    ...new Set(sorted.flatMap((points) => points.map((p) => p.timestamp))),
  ].sort((a, b) => a - b);

  // One cursor per series, advanced in step with the axis: every series is
  // sorted, so this walks each of them once rather than re-scanning per column.
  const cursors = sorted.map(() => 0);
  const carried = sorted.map(() => 0);

  return timestamps.map((timestamp) => {
    let total = 0;
    sorted.forEach((points, index) => {
      while (
        cursors[index] < points.length &&
        points[cursors[index]].timestamp <= timestamp
      ) {
        carried[index] = points[cursors[index]].value;
        cursors[index] += 1;
      }
      total += carried[index];
    });
    return { timestamp, value: total };
  });
};

export interface WeightedSeries {
  /** What the position was worth, in the common unit. */
  values: ValuePoint[];
  /** What a share cost, on any scale — only ratios of it are read. */
  prices: PricePoint[];
}

/** The last known reading at or before a moment, or undefined before them all. */
const carriedAt = <T extends { timestamp: number }>(
  points: T[],
  timestamp: number,
): T | undefined => {
  let carried: T | undefined;
  for (const point of points) {
    if (point.timestamp > timestamp) break;
    carried = point;
  }
  return carried;
};

/**
 * What the wallet earned, as a cumulative percentage rebased to the window.
 *
 * Not the change in total value: that rises when money is paid in and falls
 * when it is taken out, neither of which anyone earned. It also lurches the
 * first time a second vault appears in the series, since a vault the backend
 * has no earlier price for looks exactly like a deposit.
 *
 * So each period is measured from *price* movement, which deposits and
 * redemptions cannot touch — they change how many shares are held, not what a
 * share is worth — and the vaults are weighted by what was in each of them at
 * the start of the period. Chaining those periods is the standard
 * time-weighted return, and it is what makes the figure comparable to a
 * vault's own.
 */
export const buildWeightedReturnSeries = (
  series: WeightedSeries[],
): ValuePoint[] => {
  const sorted = series.map(({ values, prices }) => ({
    values: [...values].sort(byTimestamp),
    prices: [...prices].sort(byTimestamp),
  }));

  const timestamps = [
    ...new Set(
      sorted.flatMap(({ values, prices }) => [
        ...values.map((point) => point.timestamp),
        ...prices.map((point) => point.timestamp),
      ]),
    ),
  ].sort((a, b) => a - b);
  if (timestamps.length < 2) return [];

  const points: ValuePoint[] = [{ timestamp: timestamps[0], value: 0 }];
  let cumulative = 1;

  for (let i = 1; i < timestamps.length; i++) {
    const previous = timestamps[i - 1];
    const current = timestamps[i];

    let weighted = 0;
    let totalWeight = 0;

    for (const { values, prices } of sorted) {
      const weight = carriedAt(values, previous)?.value ?? 0;
      if (weight <= 0) continue;

      const from = carriedAt(prices, previous)?.price;
      const to = carriedAt(prices, current)?.price;
      if (!from || !to) continue;

      weighted += weight * (to / from - 1);
      totalWeight += weight;
    }

    if (totalWeight > 0) cumulative *= 1 + weighted / totalWeight;
    points.push({ timestamp: current, value: (cumulative - 1) * 100 });
  }

  return points;
};
