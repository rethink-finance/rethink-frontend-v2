import { describe, expect, it } from "vitest";

import { parseFundSlug } from "~/composables/routing/fundSlug";
import {
  resolveRewardsLink,
  resolveStakingRewards,
} from "~/store/funds/config/stakingRewards.config";

const STAKING = { chainId: "0x1", address: "0xaC3D76E29f866702E17f571cccb15937E5A17303" };
const SYC = { chainId: "0x89", address: "0xC868eAdf7DC14Cd48DC7B4A262b167a8C09b8007" };

const linkedVault = (url?: string) => parseFundSlug(url?.replace("/details/", ""));

describe("resolveRewardsLink", () => {
  it("sends soonami Venture Staking to the SNI Yield Claim Vault to claim SNI", () => {
    const link = resolveRewardsLink(STAKING.chainId, STAKING.address);
    expect(link?.label).toBe("Rewards paid in SNI");
    expect(link?.actionLabel).toBe("Claim SNI");
    expect(linkedVault(link?.url)).toEqual({ chainId: SYC.chainId, symbol: "SYC", address: SYC.address });
  });

  it("sends the SNI Yield Claim Vault back to soonami Venture Staking to earn SYC", () => {
    const link = resolveRewardsLink(SYC.chainId, SYC.address.toLowerCase());
    expect(link?.label).toBe("Earn SYC by staking");
    expect(link?.text).toMatch(/Stake ETH in soonami Venture Staking/);
    expect(linkedVault(link?.url)).toEqual({ chainId: STAKING.chainId, symbol: "sniETH", address: STAKING.address });
  });

  it("leaves the SNI Yield Claim Vault's own return alone: it is not a staking vault", () => {
    expect(resolveStakingRewards(SYC.chainId, SYC.address)).toBeUndefined();
  });

  it("has nothing for any other vault, or the right address on the wrong chain", () => {
    expect(resolveRewardsLink("0x89", "0x0000000000000000000000000000000000000001")).toBeUndefined();
    expect(resolveRewardsLink("0x1", SYC.address)).toBeUndefined();
    expect(resolveRewardsLink(undefined, SYC.address)).toBeUndefined();
  });
});
