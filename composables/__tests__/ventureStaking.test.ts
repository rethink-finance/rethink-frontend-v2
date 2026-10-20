import { describe, expect, it } from "vitest";
import {
  effectiveMultiplier,
  emissionSchedule,
  monthOneEmission,
  projectVentureStake,
  projectVentureStaking,
  tierAt,
  tierFills,
  weightedPool,
} from "../staking/ventureStaking";
import {
  VENTURE_STAKING,
  VENTURE_STAKING_ASSETS,
  VENTURE_STAKING_YIELD_STRATEGIES,
} from "../staking/ventureStakingConfig";
import { ribbonPath, yieldFlowBands } from "../staking/yieldFlow";

/** Within ±0.5% of the reference implementation's figure. */
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(0.005);

const project = (eth: number, livePoolEth: number, fdvMillions: number) => {
  const result = projectVentureStaking({ eth, livePoolEth, fdvMillions });
  if (!result) throw new Error("expected a projection");
  return result;
};

describe("venture staking emission", () => {
  it("emits about 758,320 REFI in month 1", () => {
    near(monthOneEmission(), 758_320);
  });

  it("spends the whole allocation over 72 months", () => {
    let total = 0;
    for (let t = 0; t < 72; t++) total += monthOneEmission() * 0.965 ** t;
    near(total, 20_000_000);
  });
});

describe("venture staking tiers", () => {
  it("fills tiers in deposit order", () => {
    expect(tierAt(0).name).toBe("Founding");
    expect(tierAt(5_999_999).name).toBe("Founding");
    expect(tierAt(6_000_000).name).toBe("Second");
    expect(tierAt(14_999_999).name).toBe("Second");
    expect(tierAt(15_000_000).name).toBe("Third");
    expect(tierAt(30_000_000).name).toBe("Open");
  });

  it("fades the bonus in 12-month steps", () => {
    const founding = VENTURE_STAKING.tiers[0];
    expect(effectiveMultiplier(founding, 0)).toBe(3);
    expect(effectiveMultiplier(founding, 11)).toBe(3);
    expect(effectiveMultiplier(founding, 12)).toBe(2);
    expect(effectiveMultiplier(founding, 24)).toBe(1.5);
    expect(effectiveMultiplier(founding, 36)).toBe(1);
    expect(effectiveMultiplier(founding, 71)).toBe(1);
  });

  it("weights the pool tier by tier", () => {
    const usd = (eth: number) => eth * 3_000;
    expect(weightedPool(usd(2_400), 0)).toBe(usd(2_000 * 3 + 400 * 2));
    expect(weightedPool(usd(12_000), 0)).toBe(usd(6_000 + 6_000 + 7_500 + 2_000));
  });
});

describe("projectVentureStaking", () => {
  it("10 ETH pre-launch at $40M", () => {
    const p = project(10, 0, 40);
    expect(p.tier.name).toBe("Founding");
    expect(p.tier.baseMultiplier).toBe(3);
    expect(p.isAssumedPool).toBe(true);
    expect(p.existingUsd).toBe(1_990 * 3_000);
    near(p.monthOneShare, 0.005);
    near(p.refi12, 37_687);
    near(p.valueUsd, 15_075);
    expect(Math.round(p.multipleVsYield)).toBe(17);
  });

  it("10 ETH pre-launch at $25M", () => {
    const p = project(10, 0, 25);
    near(p.valueUsd, 9_422);
    expect(Math.round(p.multipleVsYield)).toBe(10);
  });

  it("10 ETH pre-launch at $100M", () => {
    const p = project(10, 0, 100);
    near(p.valueUsd, 37_686);
    expect(Math.round(p.multipleVsYield)).toBe(42);
  });

  it("1 ETH pre-launch at $40M", () => {
    const p = project(1, 0, 40);
    near(p.refi12, 3_769);
    near(p.valueUsd, 1_507);
  });

  it("100 ETH into a 1,500 ETH pool", () => {
    const p = project(100, 1_500, 40);
    expect(p.tier.name).toBe("Founding");
    expect(p.isAssumedPool).toBe(false);
    near(p.monthOneShare, 0.0625);
    near(p.refi12, 471_100);
    near(p.valueUsd, 188_432);
    expect(Math.round(p.multipleVsYield)).toBe(21);
  });

  it("10 ETH into a 2,400 ETH pool lands in Second", () => {
    const p = project(10, 2_400, 40);
    expect(p.tier.name).toBe("Second");
    expect(p.tier.baseMultiplier).toBe(2);
    near(p.monthOneShare, 20 / 6_820); // shows as 0.29%
    near(p.refi12, 22_100);
    near(p.valueUsd, 8_841);
  });

  it("10 ETH into a 6,000 ETH pool lands in Third", () => {
    const p = project(10, 6_000, 40);
    expect(p.tier.name).toBe("Third");
    near(p.refi12, 8_365);
    near(p.valueUsd, 3_346);
  });

  it("10 ETH into a 12,000 ETH pool lands in Open", () => {
    const p = project(10, 12_000, 40);
    expect(p.tier.name).toBe("Open");
    near(p.refi12, 3_504);
    near(p.valueUsd, 1_402);
  });

  it("returns null instead of NaN for empty or invalid amounts", () => {
    expect(projectVentureStaking({ eth: 0, livePoolEth: 0, fdvMillions: 40 })).toBeNull();
    expect(projectVentureStaking({ eth: -1, livePoolEth: 0, fdvMillions: 40 })).toBeNull();
    expect(projectVentureStaking({ eth: NaN, livePoolEth: 0, fdvMillions: 40 })).toBeNull();
    expect(projectVentureStaking({ eth: Infinity, livePoolEth: 0, fdvMillions: 40 })).toBeNull();
  });

  it("treats a failed pool read as pre-launch", () => {
    const p = project(10, NaN, 40);
    expect(p.isAssumedPool).toBe(true);
    near(p.valueUsd, 15_075);
  });
});

describe("projectVentureStake with WBTC and USDC", () => {
  const [eth, wbtc, usdc] = VENTURE_STAKING_ASSETS;
  const stake = (asset: typeof eth, amount: number, livePoolUsd = 0) => {
    const result = projectVentureStake({ asset, amount, livePoolUsd, fdvMillions: 40 });
    if (!result) throw new Error("expected a projection");
    return result;
  };

  it("weighs a deposit at its ETH value", () => {
    // $30,000 of USDC or WBTC earns the same REFI as 10 ETH at $3,000.
    const ten = stake(eth, 10);
    const dollars = stake(usdc, 30_000);
    const bitcoin = stake(wbtc, 30_000 / wbtc.priceUsd);
    expect(dollars.amountUsd).toBeCloseTo(30_000);
    expect(dollars.refi12).toBeCloseTo(ten.refi12);
    expect(bitcoin.refi12).toBeCloseTo(ten.refi12);
    expect(dollars.tier.name).toBe("Founding");
  });

  it("counts the yield the deposited asset gives up", () => {
    const dollars = stake(usdc, 30_000);
    expect(dollars.yieldRedirected).toBeCloseTo(30_000 * usdc.yieldRate);
    expect(dollars.yieldRedirectedUsd).toBeCloseTo(30_000 * usdc.yieldRate);
    expect(dollars.multipleVsYield).toBeCloseTo(dollars.valueUsd / (30_000 * usdc.yieldRate));

    const bitcoin = stake(wbtc, 0.3);
    expect(bitcoin.yieldRedirected).toBeCloseTo(0.3 * wbtc.yieldRate);
    expect(bitcoin.yieldRedirectedUsd).toBeCloseTo(0.3 * wbtc.yieldRate * wbtc.priceUsd);
  });

  it("places a deposit by the USD already in the pool", () => {
    expect(stake(usdc, 30_000, 7_200_000).tier.name).toBe("Second");
    expect(stake(wbtc, 1, 5_990_000).tier.name).toBe("Founding");
  });

  it("returns null for an empty amount", () => {
    expect(projectVentureStake({ asset: usdc, amount: NaN, livePoolUsd: 0, fdvMillions: 40 })).toBeNull();
  });
});

describe("emissionSchedule", () => {
  it("lists 72 decaying months that sum to the allocation", () => {
    const schedule = emissionSchedule();
    expect(schedule).toHaveLength(72);
    near(schedule[0], 758_320);
    expect(schedule[1] / schedule[0]).toBeCloseTo(0.965);
    near(schedule.reduce((a, b) => a + b, 0), 20_000_000);
  });
});

describe("tierFills", () => {
  it("fills tiers in order and marks the one a new deposit enters", () => {
    const fills = tierFills(7_200_000);
    expect(fills.map((f) => f.filledUsd)).toEqual([6_000_000, 1_200_000, 0, 0]);
    expect(fills[1].ratio).toBeCloseTo(1_200_000 / 9_000_000);
    expect(fills.map((f) => f.isCurrent)).toEqual([false, true, false, false]);
    expect(fills[2].startUsd).toBe(15_000_000);
  });

  it("treats an empty or failed read as a fresh pool", () => {
    const fills = tierFills(NaN);
    expect(fills[0].isCurrent).toBe(true);
    expect(fills.every((f) => f.filledUsd === 0)).toBe(true);
  });
});

describe("yield strategies", () => {
  it("places every asset's whole deposit", () => {
    for (const [symbol, strategy] of Object.entries(VENTURE_STAKING_YIELD_STRATEGIES)) {
      const total = strategy.sources.reduce((sum, source) => sum + source.weight, 0);
      expect(total, symbol).toBeCloseTo(1);
    }
  });
});

describe("yieldFlowBands", () => {
  it("slices the deposit by weight and spaces the venue nodes", () => {
    const bands = yieldFlowBands([0.5, 0.25, 0.25], 220, 10);
    expect(bands.map((b) => b.from)).toEqual([[0, 110], [110, 165], [165, 220]]);
    expect(bands[0].to).toEqual([0, 100]);
    expect(bands[1].to).toEqual([110, 160]);
    expect(bands[2].to[1]).toBeCloseTo(220);
  });

  it("draws nothing without weights", () => {
    expect(yieldFlowBands([], 200, 8)).toEqual([]);
    expect(yieldFlowBands([0, 0], 200, 8)).toEqual([]);
  });

  it("closes each ribbon", () => {
    expect(ribbonPath(0, 100, [0, 10], [20, 30])).toBe(
      "M0.00,0.00 C50.00,0.00 50.00,20.00 100.00,20.00 L100.00,30.00 C50.00,30.00 50.00,10.00 0.00,10.00 Z",
    );
  });
});
