import { describe, expect, it } from "vitest";
import {
  effectiveMultiplier,
  monthOneEmission,
  projectVentureStaking,
  tierAt,
  weightedPool,
} from "../staking/ventureStaking";
import { VENTURE_STAKING } from "../staking/ventureStakingConfig";

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
    expect(tierAt(1_999).name).toBe("Founding");
    expect(tierAt(2_000).name).toBe("Second");
    expect(tierAt(4_999).name).toBe("Second");
    expect(tierAt(5_000).name).toBe("Third");
    expect(tierAt(10_000).name).toBe("Open");
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
    expect(weightedPool(2_400, 0)).toBe(2_000 * 3 + 400 * 2);
    expect(weightedPool(12_000, 0)).toBe(6_000 + 6_000 + 7_500 + 2_000);
  });
});

describe("projectVentureStaking", () => {
  it("10 ETH pre-launch at $40M", () => {
    const p = project(10, 0, 40);
    expect(p.tier.name).toBe("Founding");
    expect(p.tier.baseMultiplier).toBe(3);
    expect(p.isAssumedPool).toBe(true);
    expect(p.existingEth).toBe(1_990);
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
