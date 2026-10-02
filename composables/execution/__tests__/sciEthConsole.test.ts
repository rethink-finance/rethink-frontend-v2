import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  COW_EMPTY_APP_DATA,
  COW_ORDER_SECONDS,
  SCI,
  accrueAllowance,
  cowBuildOrder,
  cowOrderUid,
  cowValidDuration,
  cowWorstCaseCost,
  sciBatch,
  sciPlans,
  fmtEth,
  parseEth,
  sciAccounting,
  sciCalls,
  type SciState,
} from "../sciEthConsole";

const eth = (n: number | string) => ethers.parseEther(String(n));
const DAY = 86400;

/** A finalized vault with nothing in it; each test fills in what it is about. */
const state = (over: Partial<Omit<SciState, "staking" | "vault" | "allowance">> & {
  staking?: Partial<SciState["staking"]>;
  vault?: Partial<SciState["vault"]>;
  allowance?: Partial<SciState["allowance"]>;
} = {}): SciState => ({
  block: 1,
  now: 1_800_000_000,
  safeEth: 0n,
  safeWeth: 0n,
  safeSteth: 0n,
  stethCowAllowance: 0n,
  batching: false,
  fundWeth: 0n,
  multisigEth: 0n,
  ...over,
  staking: { exists: true, staked: 0n, withdrawable: 0n, claimableRewards: 0n, quota: 0n, ...over.staking },
  vault: {
    finalized: true,
    supply: 0n,
    totalNav: 0n,
    feeBal: 0n,
    lastNavUpdate: 0,
    pendingDeposits: 0n,
    pendingWithdrawShares: 0n,
    ...over.vault,
  },
  allowance: { available: eth(5), max: eth(5), refill: eth(5), period: 30 * DAY, nextRefillAt: null, ...over.allowance },
});
const keys = (s: SciState) => sciAccounting(s).steps.map((step) => step.key);
/** What the console sets aside for redemptions worth `value`: a millionth and a gwei of headroom on top. */
const funded = (value: bigint) => value + value / 1_000_000n + 10n ** 9n;

describe("sciAccounting: how much of the Safe's ETH is yield", () => {
  it("claimed rewards beside fully counted principal are all yield", () => {
    const a = sciAccounting(state({
      safeEth: eth(1.5),
      safeWeth: eth(4),
      staking: { staked: eth(96) },
      vault: { supply: eth(100), totalNav: eth(100) },
    }));
    expect(a.gap).toBe(0n);
    expect(a.principalInSafeEth).toBe(0n);
    expect(a.yieldInSafe).toBe(eth(1.5));
    expect(a.sendNow).toBe(eth(1.5));
    expect(a.settle).toMatchObject({ unwrap: 0n, updateNav: false, send: eth(1.5), leftover: 0n });
    expect(a.steps.find((s) => s.key === "settle")?.title).toBe("Send 1.5 ETH to the multisig");
  });

  it("holds back principal that was unwrapped to be staked", () => {
    // 100 owed, 64 staked, 36 unwrapped and waiting for quota, plus 2 of rewards.
    const a = sciAccounting(state({
      safeEth: eth(38),
      staking: { staked: eth(64) },
      vault: { supply: eth(100), totalNav: eth(64) },
    }));
    expect(a.principalUncounted).toBe(eth(36));
    expect(a.principalInSafeEth).toBe(eth(36));
    expect(a.yieldInSafe).toBe(eth(2));
    expect(a.sendNow).toBe(eth(2));
    expect(a.steps.find((s) => s.key === "wrap")?.amount).toBe(eth(36));
    expect(a.steps.find((s) => s.key === "stake")).toBeUndefined();
  });

  it("suggests staking what the operator approved, and wrapping only the rest", () => {
    // 36 of principal unwrapped, quota for one validator: stake 32, wrap 4.
    const a = sciAccounting(state({
      safeEth: eth(38),
      staking: { staked: eth(64), quota: eth(32) },
      vault: { supply: eth(100), totalNav: eth(64) },
    }));
    expect(a.steps.find((s) => s.key === "stake")?.amount).toBe(eth(32));
    expect(a.steps.find((s) => s.key === "wrap")?.amount).toBe(eth(4));
    expect(a.sendNow).toBe(eth(2));
  });

  it("never suggests staking yield, whatever the quota", () => {
    const a = sciAccounting(state({
      safeEth: eth(40),
      staking: { staked: eth(100), quota: eth(64) },
      vault: { supply: eth(100), totalNav: eth(100) },
    }));
    expect(a.steps.find((s) => s.key === "stake")).toBeUndefined();
  });

  it("never offers more than the cap, and says what waits", () => {
    const a = sciAccounting(state({
      safeEth: eth(8),
      staking: { staked: eth(100) },
      vault: { supply: eth(100), totalNav: eth(100) },
    }));
    expect(a.yieldInSafe).toBe(eth(8));
    expect(a.sendNow).toBe(eth(5));
    expect(a.settle.leftover).toBe(eth(3));
    expect(a.steps.find((s) => s.key === "settle")?.why).toContain("3 ETH");
  });

  it("offers nothing when the cap is spent", () => {
    const a = sciAccounting(state({
      safeEth: eth(2),
      staking: { staked: eth(100) },
      vault: { supply: eth(100), totalNav: eth(100) },
      allowance: { available: 0n },
    }));
    expect(a.sendNow).toBe(0n);
    expect(keys(state({ safeEth: eth(2), staking: { staked: eth(100) }, vault: { supply: eth(100), totalNav: eth(100) }, allowance: { available: 0n } }))).not.toContain("settle");
  });

  it("holds the Safe's ETH back while a validator exit is in flight", () => {
    // 32 ETH has left stakedBalance() and not reached the staking vault yet:
    // the NAV cannot see it, so the 1 ETH in the Safe is not provably yield.
    const a = sciAccounting(state({
      safeEth: eth(1),
      safeWeth: eth(4),
      staking: { staked: eth(64) },
      vault: { supply: eth(100), totalNav: eth(100) },
    }));
    expect(a.principalUncounted).toBe(eth(32));
    expect(a.sendNow).toBe(0n);
    // The stored NAV still holds the 32; refreshing it now would write the dip into the price.
    expect(a.navStale).toBe(true);
    expect(a.settle).toMatchObject({ navHeld: true, updateNav: false, send: 0n });
    expect(a.steps.map((s) => s.key)).toEqual(["exitInFlight"]);
    expect(a.steps[0]).toMatchObject({ info: true });
    expect(a.steps[0].title).toContain("31 ETH");
  });

  it("finds yield that is being counted and can be unwrapped", () => {
    const a = sciAccounting(state({
      safeWeth: eth(5),
      staking: { staked: eth(96) },
      vault: { supply: eth(100), totalNav: eth(101) },
    }));
    expect(a.surplusCounted).toBe(eth(1));
    expect(a.unwrappableSurplus).toBe(eth(1));
    expect(a.sendNow).toBe(0n);
    expect(a.price).toBe(eth(1.01));
    // Unwrapped it becomes yield in the Safe, and goes on in the same transaction.
    expect(a.settle).toMatchObject({ unwrap: eth(1), send: eth(1) });
    expect(a.steps.find((s) => s.key === "settle")?.title).toBe("Unwrap 1 WETH, send 1 ETH to the multisig");
  });

  it("limits the unwrap to the WETH actually in the Safe", () => {
    // The surplus is stETH growth; only 0.2 of it can leave by unwrapping.
    const a = sciAccounting(state({
      safeWeth: eth(0.2),
      safeSteth: eth(101),
      vault: { supply: eth(100), totalNav: eth(101.2) },
    }));
    expect(a.surplusCounted).toBe(eth(1.2));
    expect(a.unwrappableSurplus).toBe(eth(0.2));
  });

  it("treats everything as the operator's own money before the vault is finalized", () => {
    const a = sciAccounting(state({
      safeEth: eth(0.5),
      vault: { finalized: false, supply: 0n, totalNav: null },
      staking: { exists: false },
    }));
    expect(a.owed).toBe(0n);
    expect(a.sendNow).toBe(eth(0.5));
    expect(a.price).toBeNull();
    expect(a.steps[0].key).toBe("createStakingVault");
  });
});

describe("sciAccounting: NAV freshness, redemptions, ordering", () => {
  it("flags a stored NAV that no longer matches the positions", () => {
    // Stored: 64 staked. Now: 96 staked after another 32 went in.
    const s = state({
      safeWeth: eth(4),
      staking: { staked: eth(96) },
      vault: { supply: eth(100), totalNav: eth(68) },
    });
    const a = sciAccounting(s);
    expect(a.storedMethods).toBe(eth(64));
    expect(a.liveMethods).toBe(eth(96));
    expect(a.navStale).toBe(true);
    expect(a.price).toBe(eth(0.68));
    expect(a.priceIfUpdated).toBe(eth(1));
    expect(a.settle.updateNav).toBe(true);
    expect(a.steps.find((step) => step.key === "settle")?.title).toBe("Update the NAV");
  });

  it("ignores a wei of stETH rounding", () => {
    const a = sciAccounting(state({
      safeSteth: eth(10) - 2n,
      staking: { staked: eth(90) },
      vault: { supply: eth(100), totalNav: eth(100) },
    }));
    expect(a.navStale).toBe(false);
    expect(a.steps).toHaveLength(0);
  });

  it("asks for the WETH that requested redemptions are short of", () => {
    const a = sciAccounting(state({
      safeWeth: eth(9),
      fundWeth: eth(1),
      staking: { staked: eth(90) },
      vault: { supply: eth(100), totalNav: eth(100), pendingWithdrawShares: eth(6) },
    }));
    expect(a.redemptionShortfall).toBe(funded(eth(6)) - eth(1));
    expect(a.steps.find((s) => s.key === "fundRedemptions")?.amount).toBe(funded(eth(6)) - eth(1));
  });

  it("budgets redemptions at 1:1 even while the price reads low", () => {
    // 32 of principal is unwrapped, so the price reads 0.68; 6 shares still need 6 WETH.
    const a = sciAccounting(state({
      safeEth: eth(32),
      safeWeth: eth(4),
      staking: { staked: eth(64) },
      vault: { supply: eth(100), totalNav: eth(68), pendingWithdrawShares: eth(6) },
    }));
    expect(a.priceIfUpdated).toBe(eth(0.68));
    expect(a.redemptionShortfall).toBe(funded(eth(6)));
  });

  it("budgets redemptions the way the vault pays them: rounded up, at the price after yield is settled out", () => {
    // 100 shares, 3 of them leaving. The NAV counts 100.000000000000000007: the vault would pay
    // floor(NAV * 3 / 100), and refuses the withdrawal if it is a wei short.
    const s = state({
      safeWeth: eth(10) + 7n,
      staking: { staked: eth(90) },
      vault: { supply: eth(100), totalNav: eth(100) + 7n, pendingWithdrawShares: eth(3) },
    });
    const pays = ((eth(100) + 7n) * eth(3)) / eth(100);
    expect(sciAccounting(s).redemptionShortfall > pays).toBe(true);
    // Yield still counted as WETH is unwrapped in the same transaction, so it is not paid out to the redeemer.
    const withYield = state({
      safeWeth: eth(11),
      staking: { staked: eth(90) },
      vault: { supply: eth(100), totalNav: eth(101), pendingWithdrawShares: eth(3) },
    });
    expect(sciAccounting(withYield).redemptionShortfall).toBe(funded(eth(3)));
  });

  it("puts creating the staking vault first", () => {
    expect(keys(state({ staking: { exists: false }, safeEth: eth(1) }))[0]).toBe("createStakingVault");
  });
});

describe("sciAccounting: suggested amounts for Lido", () => {
  it("suggests depositing only principal that has no staking quota waiting", () => {
    // 36 of principal unwrapped, quota for one validator, 2 of rewards.
    const a = sciAccounting(state({
      safeEth: eth(38),
      staking: { staked: eth(64), quota: eth(32) },
      vault: { supply: eth(100), totalNav: eth(64) },
    }));
    expect(a.principalToPlace).toBe(eth(4));
  });

  it("suggests no deposit when the Safe's ETH is all yield", () => {
    const a = sciAccounting(state({
      safeEth: eth(3),
      staking: { staked: eth(100) },
      vault: { supply: eth(100), totalNav: eth(100) },
    }));
    expect(a.principalToPlace).toBe(0n);
  });

  it("suggests selling the yield that has built up in stETH", () => {
    // 100 owed, 60 staked, 41.5 stETH: 1.5 of stETH growth, no WETH to unwrap instead.
    const a = sciAccounting(state({
      safeSteth: eth(41.5),
      staking: { staked: eth(60) },
      vault: { supply: eth(100), totalNav: eth(101.5) },
    }));
    expect(a.surplusCounted).toBe(eth(1.5));
    expect(a.stethToSell).toBe(eth(1.5));
  });

  it("prefers unwrapping: only the surplus WETH cannot cover is suggested for sale", () => {
    const a = sciAccounting(state({
      safeWeth: eth(1),
      safeSteth: eth(41.5),
      staking: { staked: eth(59) },
      vault: { supply: eth(100), totalNav: eth(101.5) },
    }));
    expect(a.unwrappableSurplus).toBe(eth(1));
    expect(a.stethToSell).toBe(eth(0.5));
  });

  it("suggests selling for the WETH that redemptions are short of", () => {
    // 10 shares waiting, vault contract and Safe hold 2 WETH between them.
    const a = sciAccounting(state({
      safeWeth: eth(1),
      fundWeth: eth(1),
      safeSteth: eth(40),
      staking: { staked: eth(58) },
      vault: { supply: eth(100), totalNav: eth(100), pendingWithdrawShares: eth(10) },
    }));
    expect(a.redemptionShortfall).toBe(funded(eth(10)) - eth(1));
    expect(a.stethToSell).toBe(funded(eth(10)) - eth(2));
  });

  it("never suggests selling more stETH than the Safe holds, or principal for no reason", () => {
    expect(sciAccounting(state({
      safeSteth: eth(1),
      staking: { staked: eth(64) },
      vault: { supply: eth(60), totalNav: eth(65) },
    })).stethToSell).toBe(eth(1) - 2n);
    expect(sciAccounting(state({
      safeSteth: eth(40),
      staking: { staked: eth(60) },
      vault: { supply: eth(100), totalNav: eth(100) },
    })).stethToSell).toBe(0n);
  });
});

describe("accrueAllowance", () => {
  const stored = { refill: eth(5), maxRefill: eth(5), period: BigInt(30 * DAY), balance: 0n, timestamp: 1_000_000n };

  it("stays empty until the period has passed", () => {
    const a = accrueAllowance(stored, 1_000_000 + 29 * DAY);
    expect(a.available).toBe(0n);
    expect(a.nextRefillAt).toBe(1_000_000 + 30 * DAY);
  });

  it("refills on the day", () => {
    const a = accrueAllowance(stored, 1_000_000 + 30 * DAY);
    expect(a.available).toBe(eth(5));
    expect(a.nextRefillAt).toBeNull();
  });

  it("does not build up over unused months", () => {
    expect(accrueAllowance(stored, 1_000_000 + 200 * DAY).available).toBe(eth(5));
  });

  it("counts the next refill from the last one, not from now", () => {
    const a = accrueAllowance({ ...stored, balance: eth(1), refill: eth(1) }, 1_000_000 + 45 * DAY);
    expect(a.available).toBe(eth(2));
    expect(a.nextRefillAt).toBe(1_000_000 + 60 * DAY);
  });
});

describe("amounts", () => {
  it("rounds what it prints DOWN", () => {
    expect(fmtEth(eth("1.9999999"))).toBe("1.999999");
    expect(fmtEth(eth("5"))).toBe("5");
    expect(fmtEth(eth("0.5"))).toBe("0.5");
    expect(fmtEth(1n)).toBe("<0.000001");
    expect(fmtEth(0n)).toBe("0");
  });

  it("parses typed amounts and refuses the rest", () => {
    expect(parseEth("1.5")).toBe(eth(1.5));
    expect(parseEth("1,5")).toBe(eth(1.5));
    expect(parseEth("0")).toBeNull();
    expect(parseEth("")).toBeNull();
    expect(parseEth("abc")).toBeNull();
    expect(parseEth("-1")).toBeNull();
    expect(parseEth("1.0000000000000000001")).toBeNull();
  });
});

describe("sciCalls", () => {
  it("sends yield as plain ETH to the multisig and nothing else", () => {
    const call = sciCalls.sendYield(eth(1));
    expect(call.to).toBe(SCI.ADDR.multisig);
    expect(call.data).toBe("0x");
    expect(BigInt(call.value!)).toBe(eth(1));
  });

  it("stakes with a plain ETH send to the staking vault", () => {
    const call = sciCalls.stake(eth(32));
    expect(call.to).toBe(SCI.ADDR.stakingVault);
    expect(call.data).toBe("0x");
    expect(BigInt(call.value!)).toBe(eth(32));
  });

  it("uses the selectors the role was scoped with", () => {
    expect(sciCalls.wrap(1n).data).toBe("0xd0e30db0");
    expect(sciCalls.unwrap(1n).data.slice(0, 10)).toBe("0x2e1a7d4d");
    expect(sciCalls.createStakingVault().data).toBe("0x9abbdf4b" + "0".repeat(64));
    expect(sciCalls.requestStakeQuota(1n).data.slice(0, 10)).toBe("0x1c1408f0");
    expect(sciCalls.claimRewards().data).toBe("0x372500ab");
    expect(sciCalls.withdrawPrincipal().data).toBe("0xe1f06f54");
    expect(sciCalls.lidoSubmit(1n).data.slice(0, 10)).toBe("0xa1903eab");
    expect(sciCalls.updateNav().data.slice(0, 10)).toBe("0xa61f5814");
    expect(sciCalls.fundRedemptions(1n).data.slice(0, 10)).toBe("0xa9059cbb");
  });
});

describe("CoW order: the way back from stETH", () => {
  const quote = { id: 7, sellAmount: eth(100), networkCost: eth("0.004"), buyAmount: eth("99.92") };
  const NOW = 1_800_000_000;
  const order = cowBuildOrder(quote, 50, NOW);

  it("sells the amount asked for and takes slippage off what is received", () => {
    expect(order.sellAmount).toBe(eth(100));
    expect(order.buyAmount).toBe((eth("99.92") * 9950n) / 10000n);
    expect(order.validTo).toBe(NOW + COW_ORDER_SECONDS);
  });

  it("states the worst case against 1:1", () => {
    const { cost, bps } = cowWorstCaseCost(order);
    expect(cost).toBe(eth(100) - order.buyAmount);
    expect(bps).toBe(57); // 0.08% quote + 0.5% slippage, rounded down
  });

  it("stays inside what the role allows: under a day, bound covers validTo", () => {
    const duration = cowValidDuration(order, NOW);
    expect(duration).toBeLessThanOrEqual(86400);
    expect(NOW + duration).toBeGreaterThan(order.validTo);
  });

  it("signs exactly the pinned order, as a delegatecall to the signer", () => {
    const call = sciCalls.signCowOrder(order, cowValidDuration(order, NOW));
    expect(call.to).toBe(SCI.ADDR.cowSigner);
    expect(call.operation).toBe(1);
    expect(call.value).toBeUndefined();
    const iface = new ethers.Interface([
      "function signOrder((address sellToken,address buyToken,address receiver,uint256 sellAmount,uint256 buyAmount,uint32 validTo,bytes32 appData,uint256 feeAmount,bytes32 kind,bool partiallyFillable,bytes32 sellTokenBalance,bytes32 buyTokenBalance) order,uint32 validDuration,uint256 feeAmountBP)",
    ]);
    const [signed, validDuration, feeAmountBP] = iface.decodeFunctionData("signOrder", call.data);
    expect(signed.sellToken).toBe(SCI.ADDR.steth);
    expect(signed.buyToken).toBe(SCI.ADDR.weth);
    expect(signed.receiver).toBe(SCI.ADDR.safe);
    expect(signed.appData).toBe(COW_EMPTY_APP_DATA);
    expect(signed.appData).toBe("0xb48d38f93eaa084033fc5970bf96e559c33c4cdc07d889ab00b4d63f9590739d");
    expect(signed.feeAmount).toBe(0n);
    expect(signed.kind).toBe(ethers.id("sell"));
    expect(signed.partiallyFillable).toBe(false);
    expect(signed.sellTokenBalance).toBe(ethers.id("erc20"));
    expect(signed.buyTokenBalance).toBe(ethers.id("erc20"));
    expect(signed.sellAmount).toBe(order.sellAmount);
    expect(signed.buyAmount).toBe(order.buyAmount);
    expect(Number(validDuration)).toBe(cowValidDuration(order, NOW));
    expect(feeAmountBP).toBe(0n);
  });

  it("cancels with the same order, also as a delegatecall", () => {
    const call = sciCalls.unsignCowOrder(order);
    expect(call.to).toBe(SCI.ADDR.cowSigner);
    expect(call.operation).toBe(1);
  });

  it("approves the relayer, not the settlement contract", () => {
    const call = sciCalls.approveCow(eth(100));
    expect(call.to).toBe(SCI.ADDR.steth);
    expect(call.data.slice(0, 10)).toBe("0x095ea7b3");
    expect(call.data.toLowerCase()).toContain(SCI.ADDR.cowRelayer.slice(2).toLowerCase());
  });

  it("derives the order id from the digest, the Safe and validTo", () => {
    const uid = cowOrderUid(order);
    expect(uid.length).toBe(2 + 2 * 56);
    expect(uid.slice(66, 106).toLowerCase()).toBe(SCI.ADDR.safe.slice(2).toLowerCase());
    expect(parseInt(uid.slice(106), 16)).toBe(order.validTo);
    // Any change to the order changes the id.
    expect(cowOrderUid({ ...order, buyAmount: order.buyAmount - 1n }).slice(0, 66)).not.toBe(uid.slice(0, 66));
  });
});

describe("one-transaction moves (batching)", () => {
  const ms = new ethers.Interface(["function multiSend(bytes transactions) payable"]);
  /** Take a MultiSend payload apart again: [operation, to, value, data] per entry. */
  const unpack = (data: string) => {
    const bytes = ethers.getBytes(ms.decodeFunctionData("multiSend", data)[0]);
    const entries: { operation: number; to: string; value: bigint; data: string }[] = [];
    let i = 0;
    while (i < bytes.length) {
      const operation = bytes[i];
      const to = ethers.getAddress(ethers.hexlify(bytes.slice(i + 1, i + 21)));
      const value = BigInt(ethers.hexlify(bytes.slice(i + 21, i + 53)));
      const length = Number(BigInt(ethers.hexlify(bytes.slice(i + 53, i + 85))));
      entries.push({ operation, to, value, data: ethers.hexlify(bytes.slice(i + 85, i + 85 + length)) });
      i += 85 + length;
    }
    return entries;
  };
  const live = (over: Parameters<typeof state>[0] = {}) => state({ batching: true, ...over });

  it("stakes WETH principal as unwrap + stake + NAV update, in that order, in one delegatecall", () => {
    const s = live({
      safeWeth: eth(40),
      staking: { quota: eth(32) },
      vault: { supply: eth(40), totalNav: eth(40) },
    });
    expect(sciAccounting(s).stakeAmount).toBe(eth(32));
    const plan = sciPlans.stake(s, eth(32));
    expect(plan.problem).toBe("");
    expect(plan.call.to).toBe(SCI.ADDR.multiSend);
    expect(plan.call.operation).toBe(1);
    const parts = unpack(plan.call.data);
    expect(parts.map((p) => p.to)).toEqual([SCI.ADDR.weth, SCI.ADDR.stakingVault, SCI.ADDR.fund]);
    expect(parts[0].data.slice(0, 10)).toBe("0x2e1a7d4d");
    expect(parts[1]).toMatchObject({ value: eth(32), data: "0x", operation: 0 });
    expect(parts[2].data.slice(0, 10)).toBe("0xa61f5814");
    expect(parts.every((p) => p.operation === 0)).toBe(true);
  });

  it("produces byte for byte the batch that passed the dry run on mainnet state", () => {
    // simulate-batch.cjs sent unwrap 32 + stake 32 + Update NAV through the role with the unwrapper set;
    // this is the keccak of that multiSend calldata, built there independently of this module.
    const s = live({
      safeWeth: eth(40),
      staking: { quota: eth(32) },
      vault: { supply: eth(40), totalNav: eth(40) },
    });
    expect(ethers.keccak256(sciPlans.stake(s, eth(32)).call.data)).toBe(
      "0x7cb579792a6979cd6b6e4738075e4e886540ade85f273c42ada64c1723ffbd13",
    );
  });

  it("uses principal that is already plain ETH before unwrapping anything", () => {
    const s = live({
      safeEth: eth(20),
      safeWeth: eth(20),
      staking: { quota: eth(32) },
      vault: { supply: eth(40), totalNav: eth(20) },
    });
    const parts = unpack(sciPlans.stake(s, eth(32)).call.data);
    // 20 is already ETH, so only 12 is unwrapped.
    expect(BigInt("0x" + parts[0].data.slice(10))).toBe(eth(12));
    expect(parts[1].value).toBe(eth(32));
  });

  it("leaves the WETH that requested redemptions need", () => {
    const withRedemptions = (weth: number) => sciAccounting(live({
      safeWeth: eth(weth),
      staking: { quota: eth(64) },
      vault: { supply: eth(weth), totalNav: eth(weth), pendingWithdrawShares: eth(10) },
    })).stakeAmount;
    // 10 WETH is owed to redemptions: 40 leaves 30 free (no whole validator), 50 leaves 40 (one).
    expect(withRedemptions(40)).toBe(0n);
    expect(withRedemptions(50)).toBe(eth(32));
  });

  it("without batching, only plain ETH can be staked and it is a single call", () => {
    const s = state({
      safeEth: eth(32),
      safeWeth: eth(8),
      staking: { quota: eth(32) },
      vault: { supply: eth(40), totalNav: eth(8) },
    });
    const plan = sciPlans.stake(s, eth(32));
    expect(plan.call.to).toBe(SCI.ADDR.stakingVault);
    expect(plan.call.operation).toBeUndefined();
    expect(sciAccounting(state({ safeWeth: eth(40), staking: { quota: eth(32) }, vault: { supply: eth(40), totalNav: eth(40) } })).stakeAmount).toBe(0n);
  });

  it("brings principal back as withdraw + wrap + NAV update", () => {
    const s = live({ staking: { withdrawable: eth(32) }, vault: { supply: eth(32), totalNav: eth(32) } });
    const parts = unpack(sciPlans.withdrawPrincipal(s).call.data);
    expect(parts.map((p) => p.to)).toEqual([SCI.ADDR.stakingVault, SCI.ADDR.weth, SCI.ADDR.fund]);
    expect(parts[0].data).toBe("0xe1f06f54");
    expect(parts[1]).toMatchObject({ value: eth(32), data: "0xd0e30db0" });
  });

  it("a stake is unwrap + stake + NAV update and nothing else, even with yield waiting", () => {
    const s = live({
      safeEth: eth(2),
      safeWeth: eth(40),
      staking: { staked: eth(60), quota: eth(32) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    expect(sciPlans.stake(s, eth(32)).parts).toEqual(["unwrap 32 WETH", "stake 32 ETH", "update the NAV"]);
  });

  it("leaves the NAV update out before the vault is finalized", () => {
    const s = live({ safeWeth: eth(1), vault: { finalized: false, supply: 0n, totalNav: null } });
    const plan = sciPlans.lidoDeposit(s, eth(1));
    const parts = unpack(plan.call.data);
    expect(parts.map((p) => p.to)).toEqual([SCI.ADDR.weth, SCI.ADDR.steth]);
  });

  it("says so when the Safe cannot cover the amount", () => {
    const s = live({ safeWeth: eth(10), staking: { quota: eth(32) }, vault: { supply: eth(10), totalNav: eth(10) } });
    expect(sciPlans.stake(s, eth(32)).problem).not.toBe("");
  });

  it("packs a batch the way MultiSend reads it", () => {
    const call = sciBatch([sciCalls.wrap(eth(1)), sciCalls.updateNav()]);
    const parts = unpack(call.data);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ to: SCI.ADDR.weth, value: eth(1), data: "0xd0e30db0" });
    expect(parts[1].value).toBe(0n);
  });
});

describe("claims, withdrawals and settlements end at 1:1 with the excess sent", () => {
  const ms = new ethers.Interface(["function multiSend(bytes transactions) payable"]);
  const unpack = (data: string) => {
    const bytes = ethers.getBytes(ms.decodeFunctionData("multiSend", data)[0]);
    const entries: { to: string; value: bigint; data: string }[] = [];
    let i = 0;
    while (i < bytes.length) {
      const length = Number(BigInt(ethers.hexlify(bytes.slice(i + 53, i + 85))));
      entries.push({
        to: ethers.getAddress(ethers.hexlify(bytes.slice(i + 1, i + 21))),
        value: BigInt(ethers.hexlify(bytes.slice(i + 21, i + 53))),
        data: ethers.hexlify(bytes.slice(i + 85, i + 85 + length)),
      });
      i += 85 + length;
    }
    return entries;
  };
  const live = (over: Parameters<typeof state>[0] = {}) => state({ batching: true, ...over });
  // 100 owed: 96 staked, 4 WETH. The stored NAV is current.
  const staked = (over: Parameters<typeof state>[0] = {}) => live({
    safeWeth: eth(4),
    ...over,
    staking: { staked: eth(96), ...over.staking },
    vault: { supply: eth(100), totalNav: eth(100), ...over.vault },
  });
  /** What the vault reports and what is owed once a plan has run, replayed call by call. */
  const replay = (s: SciState, calls: { to: string; value: bigint; data: string }[]) => {
    let { safeEth, safeWeth } = s;
    let { staked: st, withdrawable, claimableRewards } = s.staking;
    let stored = s.vault.totalNav! - s.safeWeth - s.fundWeth;
    let sent = 0n;
    for (const c of calls) {
      const sel = c.data.slice(0, 10);
      if (c.to === SCI.ADDR.weth && sel === "0x2e1a7d4d") {
        const amount = BigInt("0x" + c.data.slice(10));
        safeWeth -= amount; safeEth += amount;
      } else if (c.to === SCI.ADDR.weth && sel === "0xd0e30db0") {
        safeWeth += c.value; safeEth -= c.value;
      } else if (c.to === SCI.ADDR.stakingVault && c.data === "0x") {
        st += c.value; safeEth -= c.value;
      } else if (c.to === SCI.ADDR.stakingVault && sel === "0xe1f06f54") {
        safeEth += withdrawable; withdrawable = 0n;
      } else if (c.to === SCI.ADDR.stakingVault) {
        safeEth += claimableRewards; claimableRewards = 0n;
      } else if (c.to === SCI.ADDR.fund) {
        stored = st + withdrawable + s.safeSteth;
      } else if (c.to === SCI.ADDR.multisig) {
        safeEth -= c.value; sent += c.value;
      } else {
        throw new Error("unexpected call " + c.to);
      }
      if (safeEth < 0n || safeWeth < 0n) throw new Error("the Safe cannot cover this");
    }
    return { reported: stored + safeWeth + s.fundWeth, sent, safeEth, safeWeth };
  };

  it("claims rewards and sends them on, with whatever yield was already waiting", () => {
    const s = staked({ safeEth: eth(0.5), staking: { claimableRewards: eth(1.5) } });
    const plan = sciPlans.claimRewards(s);
    expect(plan.problem).toBe("");
    expect(plan.parts).toEqual(["claim 1.5 ETH of rewards", "send 2 ETH to the multisig"]);
    const calls = unpack(plan.call.data);
    expect(calls.map((c) => c.to)).toEqual([SCI.ADDR.stakingVault, SCI.ADDR.multisig]);
    expect(calls[0].data).toBe(sciCalls.claimRewards().data);
    expect(calls[1]).toMatchObject({ value: eth(2), data: "0x" });
    expect(replay(s, calls)).toMatchObject({ reported: eth(100), sent: eth(2), safeEth: 0n });
  });

  it("never sends more than the cap, and says what stays", () => {
    const s = staked({ staking: { claimableRewards: eth(8) } });
    const plan = sciPlans.claimRewards(s);
    expect(plan.parts[1]).toBe("send 5 ETH to the multisig");
    expect(plan.warning).toContain("3 ETH of yield stays");
    expect(replay(s, unpack(plan.call.data))).toMatchObject({ reported: eth(100), sent: eth(5), safeEth: eth(3) });
  });

  it("with the cap spent, the claim still goes out and the rewards wait as plain ETH", () => {
    const s = staked({ staking: { claimableRewards: eth(1) }, allowance: { available: 0n } });
    const plan = sciPlans.claimRewards(s);
    expect(plan.call.to).toBe(SCI.ADDR.stakingVault);
    expect(plan.parts).toEqual(["claim 1 ETH of rewards"]);
    expect(plan.warning).toContain("1 ETH of yield stays");
  });

  it("harvests yield that built up inside stETH by unwrapping the same amount of WETH", () => {
    // 100 owed: 60 staked, 30 stETH that has grown to 30.4, 10 WETH. Stored at 100.
    const s = live({
      safeWeth: eth(10),
      safeSteth: eth(30.4),
      staking: { staked: eth(60), claimableRewards: eth(1) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    const plan = sciPlans.claimRewards(s);
    expect(plan.parts).toEqual([
      "claim 1 ETH of rewards",
      "unwrap 0.4 WETH of yield",
      "update the NAV",
      "send 1.4 ETH to the multisig",
    ]);
    expect(replay(s, unpack(plan.call.data))).toMatchObject({ reported: eth(100), sent: eth(1.4) });
  });

  it("withdraws principal into WETH and sends the rewards that came with it", () => {
    // One validator has exited: 32 is waiting in the staking vault with 0.7 of rewards.
    const s = live({
      safeWeth: eth(4),
      staking: { staked: eth(64), withdrawable: eth(32), claimableRewards: eth(0.7) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    const plan = sciPlans.withdrawPrincipal(s);
    expect(plan.problem).toBe("");
    expect(plan.parts).toEqual([
      "withdraw 32 ETH of principal",
      "claim 0.7 ETH of rewards",
      "wrap 32 ETH into WETH",
      "update the NAV",
      "send 0.7 ETH to the multisig",
    ]);
    const calls = unpack(plan.call.data);
    expect(calls.map((c) => c.to)).toEqual([
      SCI.ADDR.stakingVault, SCI.ADDR.stakingVault, SCI.ADDR.weth, SCI.ADDR.fund, SCI.ADDR.multisig,
    ]);
    expect(replay(s, calls)).toMatchObject({ reported: eth(100), sent: eth(0.7), safeEth: 0n, safeWeth: eth(36) });
  });

  it("settles a filled stETH sale: NAV update, unwrap the yield, send it", () => {
    // 100 owed. At the last update: 60 staked + 41 stETH (1 of growth). The 41 stETH has
    // just been sold for 40.9 WETH, so the vault reads 101 + 40.9 until it is settled.
    const s = live({
      safeWeth: eth(40.9),
      staking: { staked: eth(60) },
      vault: { supply: eth(100), totalNav: eth(141.9) },
    });
    const plan = sciPlans.settle(s);
    expect(plan.problem).toBe("");
    expect(plan.parts).toEqual(["unwrap 0.9 WETH of yield", "update the NAV", "send 0.9 ETH to the multisig"]);
    const replayed = replay({ ...s, safeSteth: 0n }, unpack(plan.call.data));
    expect(replayed).toMatchObject({ reported: eth(100), sent: eth(0.9) });
    // The guided step says exactly what the plan does.
    expect(sciAccounting(s).steps.find((step) => step.key === "settle")?.title)
      .toBe("Unwrap 0.9 WETH, update the NAV, send 0.9 ETH to the multisig");
  });

  it("funds redemptions, settles counted yield out and updates the NAV in one transaction", () => {
    // 100 owed, 1 of yield counted as WETH, 3 shares leaving.
    const s = live({
      safeWeth: eth(11),
      staking: { staked: eth(90) },
      vault: { supply: eth(100), totalNav: eth(101), pendingWithdrawShares: eth(3) },
    });
    const amount = sciAccounting(s).redemptionShortfall;
    const plan = sciPlans.fundRedemptions(s, amount);
    expect(plan.problem).toBe("");
    const calls = unpack(plan.call.data);
    expect(calls.map((c) => c.to)).toEqual([SCI.ADDR.weth, SCI.ADDR.weth, SCI.ADDR.fund, SCI.ADDR.multisig]);
    expect(calls[0].data).toBe(sciCalls.fundRedemptions(amount).data);
    expect(plan.parts.slice(1)).toEqual(["unwrap 1 WETH of yield", "update the NAV", "send 1 ETH to the multisig"]);
    // The NAV update goes out even when nothing is stale: it is what makes the request payable.
    const flat = live({
      safeWeth: eth(10),
      staking: { staked: eth(90) },
      vault: { supply: eth(100), totalNav: eth(100), pendingWithdrawShares: eth(3) },
    });
    expect(sciPlans.fundRedemptions(flat, eth(3)).parts).toEqual(["send 3 WETH to the vault contract", "update the NAV"]);
    expect(sciPlans.fundRedemptions(flat, eth(11)).problem).toContain("holds 10 WETH");
  });

  it("has nothing to settle on a vault that is at 1:1", () => {
    expect(sciPlans.settle(staked()).problem).toContain("Nothing to settle");
  });

  it("while a validator exit is in flight: no NAV update, nothing sent, and it says why", () => {
    // 32 has left stakedBalance and not arrived yet. Rewards are claimable.
    const s = live({
      safeWeth: eth(4),
      staking: { staked: eth(64), claimableRewards: eth(1) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    const plan = sciPlans.claimRewards(s);
    expect(plan.problem).toBe("");
    expect(plan.call.to).toBe(SCI.ADDR.stakingVault);
    expect(plan.parts).toEqual(["claim 1 ETH of rewards"]);
    expect(plan.warning).toContain("validator exit");
    expect(plan.warning).toContain("treated as principal");
  });

  it("refuses a stake that no NAV update could put right", () => {
    // Same exit in flight, 36 WETH free: unwrapping 32 would drop the vault to 68 with nothing to correct it.
    const s = live({
      safeWeth: eth(36),
      staking: { staked: eth(32), quota: eth(32) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    expect(sciPlans.stake(s, eth(32)).problem).toContain("reporting 68 ETH for 100 ETH");
  });

  it("refuses to withdraw what has arrived while the rest of an exit is still in flight", () => {
    // Three validators attested at once: 96 has left stakedBalance, 32 has landed.
    // The stored NAV still counts all 96 as staked. Withdrawn and wrapped, the 32 would be counted twice.
    const s = live({
      safeWeth: eth(4),
      staking: { staked: 0n, withdrawable: eth(32) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    expect(sciPlans.withdrawPrincipal(s).problem).toContain("reporting 132 ETH for 100 ETH");
    expect(sciAccounting(s).steps.map((step) => step.key)).toEqual(["exitInFlight"]);
    // Once all of it is there, it goes through and lands on 100.
    const landed = live({
      safeWeth: eth(4),
      staking: { staked: 0n, withdrawable: eth(96) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    const plan = sciPlans.withdrawPrincipal(landed);
    expect(plan.problem).toBe("");
    expect(plan.parts).toEqual(["withdraw 96 ETH of principal", "wrap 96 ETH into WETH", "update the NAV"]);
  });

  it("before the vault opens, a claim leaves the WETH alone; settling clears it out", () => {
    const s = live({
      safeEth: eth(0.2),
      safeWeth: eth(1),
      staking: { claimableRewards: eth(0.1) },
      vault: { finalized: false, supply: 0n, totalNav: null },
    });
    expect(sciPlans.claimRewards(s).parts).toEqual(["claim 0.1 ETH of rewards", "send 0.3 ETH to the multisig"]);
    expect(sciPlans.settle(s).parts).toEqual(["unwrap 1 WETH of yield", "send 1.2 ETH to the multisig"]);
  });

  it("without batching only the first call goes out, and the plan says what is left", () => {
    const s = state({
      safeWeth: eth(4),
      staking: { staked: eth(96), claimableRewards: eth(1) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    const plan = sciPlans.claimRewards(s);
    expect(plan.call).toEqual(sciCalls.claimRewards());
    expect(plan.warning).toContain("send 1 ETH to the multisig");
  });
});

describe("moves that would leave the NAV wrong are refused", () => {
  const live = (over: Parameters<typeof state>[0] = {}) => state({ batching: true, ...over });
  // 100 owed: 60 staked, 40 WETH; plus 2 ETH of claimed rewards.
  const healthy = () => live({
    safeEth: eth(2),
    safeWeth: eth(40),
    staking: { staked: eth(60), quota: eth(32) },
    vault: { supply: eth(100), totalNav: eth(100) },
  });

  it("refuses to wrap yield", () => {
    const plan = sciPlans.wrap(healthy(), eth(2));
    expect(plan.problem).toContain("yield");
  });

  it("allows wrapping principal that is sitting as plain ETH", () => {
    const s = live({
      safeEth: eth(10),
      safeWeth: eth(30),
      staking: { staked: eth(60) },
      vault: { supply: eth(100), totalNav: eth(90) },
    });
    expect(sciPlans.wrap(s, eth(10)).problem).toBe("");
    expect(sciPlans.wrap(s, eth(10.5)).problem).toContain("yield");
  });

  it("adds the NAV update to a wrap when the stored positions are out of date", () => {
    // 32 came back from the staking vault as plain ETH; the last update still counts it there.
    const s = live({
      safeEth: eth(32),
      safeWeth: eth(8),
      staking: { staked: eth(60) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    const plan = sciPlans.wrap(s, eth(32));
    expect(plan.problem).toBe("");
    expect(plan.call.to).toBe(SCI.ADDR.multiSend);
    expect(plan.parts).toEqual(["wrap 32 ETH", "update the NAV"]);
  });

  it("refuses to stake or lend yield", () => {
    // Only 8 WETH of principal is free: a 32 ETH stake would need 24 of... nothing. Lido 9 would dip 1 into yield.
    const s = live({
      safeEth: eth(2),
      safeWeth: eth(8),
      staking: { staked: eth(92), quota: eth(32) },
      vault: { supply: eth(100), totalNav: eth(100) },
    });
    expect(sciPlans.lidoDeposit(s, eth(8)).problem).toBe("");
    expect(sciPlans.lidoDeposit(s, eth(9)).problem).toContain("yield");
    expect(sciPlans.stake(s, eth(32)).problem).not.toBe("");
  });

  it("is off before the vault is finalized, so everything can be rehearsed", () => {
    const s = live({ safeEth: eth(1), safeWeth: eth(1), vault: { finalized: false, supply: 0n, totalNav: null } });
    expect(sciPlans.wrap(s, eth(1)).problem).toBe("");
    expect(sciPlans.lidoDeposit(s, eth(2)).problem).toBe("");
  });
});
