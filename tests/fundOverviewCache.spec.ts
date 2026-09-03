import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactDailySnapshots,
  compactNavUpdates,
  patchCachedFundOverview,
  readCachedFundOverview,
  slimFund,
} from "../store/funds/fundOverviewCache";
import type { ParsedNavUpdateDto } from "../store/funds/actions/fetchFundNavUpdates.action";
import type IFund from "../types/fund";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The module talks to window.localStorage; give it one. */
const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const fund = (overrides: Partial<IFund> = {}): IFund =>
  ({
    chainId: "0x1",
    address: "0xAbC",
    title: "Vault",
    feeBalance: -5n,
    navUpdates: [{ index: 1, date: "", timestamp: 1, entries: [] }],
    pendingDepositBalance: 7n,
    pendingDepositBalanceLoading: true,
    ...overrides,
  }) as IFund;

const update = (timestamp: number): ParsedNavUpdateDto =>
  ({
    index: timestamp,
    timestamp,
    sharePrice: 1,
    totalNAV: BigInt(timestamp),
    navMethods: [{ heavy: true }],
  }) as unknown as ParsedNavUpdateDto;

describe("slimFund", () => {
  it("drops the feeds and the in-flight flags, keeps the rest", () => {
    const slim = slimFund(fund());

    expect(slim.title).toBe("Vault");
    expect(slim.feeBalance).toBe(-5n);
    expect(slim.pendingDepositBalance).toBe(7n);
    expect(slim.navUpdates).toEqual([]);
    expect(slim).not.toHaveProperty("pendingDepositBalanceLoading");
    expect(slim).not.toHaveProperty("backendNavUpdates");
  });
});

describe("compact feeds", () => {
  it("strips the method list from every update", () => {
    const [compact] = compactNavUpdates([update(1)]);

    expect(compact.navMethods).toEqual([]);
    expect(compact.totalNAV).toBe(1n);
  });

  it("keeps the most recent entries in their original order", () => {
    const updates = Array.from({ length: 600 }, (_, i) => update(600 - i));

    const compact = compactNavUpdates(updates);

    expect(compact).toHaveLength(500);
    expect(compact[0].timestamp).toBe(600);
    expect(compact[compact.length - 1].timestamp).toBe(101);
  });

  it("keeps only what the chart reads off a daily snapshot", () => {
    const [compact] = compactDailySnapshots([
      {
        timestamp: 5,
        date: "d",
        sharePrice: 2,
        totalSimulatedNav: 3n,
        totalSupply: 4n,
        somethingElse: "dropped",
      },
    ]);

    expect(compact).toEqual({
      timestamp: 5,
      date: "d",
      sharePrice: 2,
      totalSimulatedNav: 3n,
      totalSupply: 4n,
    });
  });
});

describe("patchCachedFundOverview / readCachedFundOverview", () => {
  it("round-trips a fund through storage, bigints included", () => {
    patchCachedFundOverview("0x1", "0xAbC", { fund: fund() });

    const entry = readCachedFundOverview("0x1", "0xabc");

    expect(entry?.fund?.title).toBe("Vault");
    expect(entry?.fund?.feeBalance).toBe(-5n);
    expect(entry?.fund?.navUpdates).toEqual([]);
    expect(entry?.visitedAt).toBeGreaterThan(0);
  });

  it("builds the entry up patch by patch", () => {
    patchCachedFundOverview("0x1", "0xAbC", { fund: fund() });
    patchCachedFundOverview("0x1", "0xAbC", { roleModAddress: "0xROLE" });
    patchCachedFundOverview("0x1", "0xAbC", {
      activityRows: [
        { id: "r", kind: "deposit", label: "Deposit", dot: "", amount: "1", timestamp: 1, when: "now" },
      ],
    });

    const entry = readCachedFundOverview("0x1", "0xAbC");

    expect(entry?.fund?.title).toBe("Vault");
    expect(entry?.roleModAddress).toBe("0xROLE");
    expect(entry?.activityRows).toHaveLength(1);
  });

  it("misses for a vault never stored", () => {
    expect(readCachedFundOverview("0x1", "0xNOPE")).toBeNull();
  });

  it("serves a vault cold again after a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
    patchCachedFundOverview("0x1", "0xAbC", { fund: fund() });

    vi.setSystemTime(new Date("2026-09-04T10:00:01Z"));

    expect(readCachedFundOverview("0x1", "0xAbC")).toBeNull();
  });

  it("keeps only the eight vaults opened most recently", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(new Date(DAY_MS * 100 + i * 1000));
      patchCachedFundOverview("0x1", `0x${i}`, { fund: fund({ address: `0x${i}` }) });
    }

    expect(readCachedFundOverview("0x1", "0x0")).toBeNull();
    expect(readCachedFundOverview("0x1", "0x1")).toBeNull();
    expect(readCachedFundOverview("0x1", "0x2")).not.toBeNull();
    expect(readCachedFundOverview("0x1", "0x9")).not.toBeNull();
  });

  it("survives a storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() =>
      patchCachedFundOverview("0x1", "0xAbC", { fund: fund() }),
    ).not.toThrow();
    expect(readCachedFundOverview("0x1", "0xAbC")).toBeNull();
  });
});
