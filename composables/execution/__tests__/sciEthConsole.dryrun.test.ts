import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  SCI,
  cowOrderUid,
  cowValidDuration,
  fmtEth,
  sciAccounting,
  sciCalls,
  sciDecodeState,
  sciPlans,
  sciStateCall,
  type SciPlan,
  type SciState,
} from "../sciEthConsole";

/**
 * A rehearsal on current mainnet state, off by default (it needs the network):
 *
 *   SCI_DRY_RUN=1 npx vitest run composables/execution/__tests__/sciEthConsole.dryrun.test.ts
 *
 * Nothing is sent. Every step is an eth_simulateV1 call that replays the
 * whole story so far on top of one pinned recent block. What is under test is the
 * console's own path, end to end: its one-call state read, its accounting,
 * the plan it builds from them, and that plan going through the vault's real
 * Roles modifier as the executor wallet. After every plan the vault has to
 * report exactly one ETH per share.
 *
 * Simulated, because only the operator and the beacon chain can do them: the
 * operator's quota approval and exit attestation (sent from its address), and
 * rewards / exited principal arriving in the staking vault (a balance override).
 */
const RPCS = ["https://ethereum-rpc.publicnode.com", "https://rpc.mevblocker.io", "https://eth.drpc.org"];
const rpc = async (method: string, params: unknown[]): Promise<any> => {
  const errors: string[] = [];
  for (let round = 0; round < 3; round++) {
    for (const url of RPCS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const json = await response.json();
        if (json.error) {
          errors.push(`${url}: ${JSON.stringify(json.error).slice(0, 300)}`);
          continue;
        }
        return json.result;
      } catch (error: any) {
        errors.push(`${url}: ${error?.cause?.code || error?.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(errors.slice(-3).join(" | "));
};

const A = SCI.ADDR;
const MANAGER = "0xB5d01172e73559B07ef3CD53dE84459c6BA3a054";
const OPERATOR = "0xE0837559527A693a23fEbf7c15BC36A943464386";
const FACTORY = "0x0F46b4A1B4C794fc078A87A8118dB47ab76B25A7";
const wallet = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const ALICE = wallet(0xA11CE);
const BOB = wallet(0xB0B);
const CAROL = wallet(0xCA201);
const DONOR = wallet(0xD0);
const VIEWER = wallet(0xBEEF);

const eth = (n: number | string) => ethers.parseEther(String(n));
const hex = (v: bigint | number) => ethers.toQuantity(v);
const roles = new ethers.Interface([
  "function execTransactionWithRole(address to,uint256 value,bytes data,uint8 operation,bytes32 roleKey,bool shouldRevert)",
]);
const weth = new ethers.Interface([
  "function deposit() payable",
  "function approve(address,uint256)",
  "function transfer(address,uint256)",
]);
const fund = new ethers.Interface([
  "function fundFlowsCall(bytes)",
  "function executeNAVUpdate(address)",
  "function balanceOf(address) view returns (uint256)",
]);
const flows = new ethers.Interface([
  "function requestDeposit(uint256)",
  "function deposit()",
  "function requestWithdraw(uint256)",
  "function withdraw()",
]);
const erc20 = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
const settlement = new ethers.Interface(["function preSignature(bytes) view returns (uint256)"]);
const factory = new ethers.Interface(["function finalizeCreateFund()"]);
const staking = new ethers.Interface([
  "function requestStakeQuota(uint256)",
  "function approveStakeQuota(bytes[],bytes[],uint256[])",
  "function attestUnbondings(bytes[])",
]);
const multicall = new ethers.Interface(["function getEthBalance(address) view returns (uint256)"]);
const PUBKEY = "0x" + "ab".repeat(48);
const SIGNATURE = "0x" + "cd".repeat(96);

/** The reason inside a revert, as text when it is one. */
const revertText = (data: string) => {
  try {
    return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
  } catch {
    return data.slice(0, 138);
  }
};

interface Tx { from: string; to: string; data: string; value?: string }
interface Block { label: string; calls: Tx[]; time: number; balances?: Record<string, bigint> }

/** A call as the console sends it: through the Roles modifier, as the executor role. */
const asExecutor = (call: SciPlan["call"]): Tx => ({
  from: MANAGER,
  to: A.roles,
  data: roles.encodeFunctionData("execTransactionWithRole", [
    call.to,
    BigInt(call.value ?? "0"),
    call.data,
    call.operation ?? 0,
    ethers.encodeBytes32String(SCI.ROLE),
    true,
  ]),
});

describe.skipIf(!process.env.SCI_DRY_RUN)("sciETH console: dry run on mainnet state", () => {
  it("every plan passes the role and leaves the vault at one ETH per share", async () => {
    const head = await rpc("eth_getBlockByNumber", ["latest", false]);
    let clock = Number(head.timestamp);
    const story: Block[] = [];
    const say = (line: string) => console.log(line);

    /** Replay the story, then run `views` on top of it. Fails if any transaction in the story failed. */
    const replay = async (views: Tx[]): Promise<string[]> => {
      const rich = Object.fromEntries(
        [MANAGER, OPERATOR, ALICE, BOB, CAROL, DONOR, VIEWER].map((a) => [a, { balance: hex(eth(1000)) }]),
      );
      const blocks = [...story, { label: "views", calls: views, time: clock + 12 }];
      const result = await rpc("eth_simulateV1", [{
        validation: false,
        blockStateCalls: blocks.map((b, i) => ({
          blockOverrides: { gasLimit: "0x77359400", time: hex(b.time) },
          stateOverrides: {
            ...(i === 0 ? rich : {}),
            ...Object.fromEntries(Object.entries(b.balances ?? {}).map(([a, v]) => [a, { balance: hex(v) }])),
          },
          calls: b.calls.map((c) => ({ gas: "0x4c4b40", ...c })),
        })),
      }, head.number]);
      story.forEach((b, i) => result[i].calls.forEach((c: any, j: number) => {
        if (c.status !== "0x1") {
          throw new Error(`"${b.label}" call ${j} failed: ${c.error?.message ?? ""} ${revertText(String(c.error?.data ?? c.returnData))}`);
        }
      }));
      return result[story.length].calls.map((c: any) => c.returnData);
    };
    const push = (label: string, calls: Tx[], extra: { wait?: number; balances?: Record<string, bigint> } = {}) => {
      clock += extra.wait ?? 12;
      story.push({ label, calls, time: clock, balances: extra.balances });
    };
    const stateCall = sciStateCall();
    /** The console's own read, on the simulated state. */
    const read = async (): Promise<SciState> =>
      sciDecodeState((await replay([{ from: VIEWER, ...stateCall }]))[0]);
    const ethBalance = async (who: string) =>
      BigInt((await replay([{ from: VIEWER, to: A.multicall3, data: multicall.encodeFunctionData("getEthBalance", [who]) }]))[0]);
    const shares = async (who: string) =>
      BigInt((await replay([{ from: VIEWER, to: A.fund, data: fund.encodeFunctionData("balanceOf", [who]) }]))[0]);

    /** Send a plan exactly as the console would, then check the vault is at 1:1. */
    const run = async (title: string, plan: SciPlan, before: SciState): Promise<SciState> => {
      expect(plan.problem, title).toBe("");
      push(title, [asExecutor(plan.call)]);
      const after = await read();
      const acc = sciAccounting(after);
      say(`\n${title}`);
      say(`  one transaction: ${plan.parts.join(" → ")}`);
      if (plan.warning) say(`  note: ${plan.warning}`);
      say(`  vault reports ${fmtEth(after.vault.totalNav!)} ETH for ${fmtEth(after.vault.supply)} shares`
        + ` | multisig +${fmtEth(after.multisigEth - before.multisigEth)} ETH`
        + ` | Safe: ${fmtEth(after.safeEth)} ETH, ${fmtEth(after.safeWeth)} WETH, ${fmtEth(after.safeSteth)} stETH`
        + ` | staked ${fmtEth(after.staking.staked)} | cap left ${fmtEth(after.allowance.available)}`);
      // One ETH per share, to within stETH's wei of rounding.
      const off = after.vault.totalNav! - after.vault.supply;
      expect(off > -SCI.DUST && off < SCI.DUST, `${title}: NAV ${after.vault.totalNav} vs supply ${after.vault.supply}`).toBe(true);
      expect(acc.navStale, `${title}: stored NAV current`).toBe(false);
      return after;
    };

    const request = (who: string, amount: bigint): Tx[] => [
      { from: who, to: A.weth, value: hex(amount), data: weth.encodeFunctionData("deposit") },
      { from: who, to: A.weth, data: weth.encodeFunctionData("approve", [A.fund, amount]) },
      { from: who, to: A.fund, data: fund.encodeFunctionData("fundFlowsCall", [flows.encodeFunctionData("requestDeposit", [amount])]) },
    ];
    const settleDeposit = (who: string): Tx =>
      ({ from: who, to: A.fund, data: fund.encodeFunctionData("fundFlowsCall", [flows.encodeFunctionData("deposit")]) });
    const navUpdate = (): Tx => asExecutor(sciCalls.updateNav());

    // --- The vault opens and two depositors come in ---------------------------------------
    let s = await read();
    say(`Live state at block ${s.block}: finalized ${s.vault.finalized}, batching ${s.batching}, Safe ${fmtEth(s.safeEth)} ETH / ${fmtEth(s.safeWeth)} WETH`);
    expect(s.batching).toBe(true);
    expect(s.staking.exists).toBe(true);
    if (!s.vault.finalized) {
      // Test money left in the Safe as WETH would be counted the moment the vault opens, and the
      // first depositor would be given shares for it. The console's first guided step clears it out.
      const clear = sciPlans.settle(s);
      if (!clear.problem) {
        expect(sciAccounting(s).steps.map((step) => step.key)).toContain("settle");
        const multisigBefore = s.multisigEth;
        push("clear out the test money", [asExecutor(clear.call)]);
        s = await read();
        say(`\nBEFORE OPENING, SETTLE\n  one transaction: ${clear.parts.join(" → ")}`);
        say(`  Safe: ${fmtEth(s.safeEth)} ETH, ${fmtEth(s.safeWeth)} WETH | multisig +${fmtEth(s.multisigEth - multisigBefore)} ETH`);
        expect(s.safeWeth).toBe(0n);
      }
      push("finalize", [{ from: MANAGER, to: FACTORY, data: factory.encodeFunctionData("finalizeCreateFund") }]);
    }
    push("deposit requests", [...request(ALICE, eth(40)), ...request(BOB, eth(10))]);
    push("quota", [
      asExecutor(sciCalls.requestStakeQuota(eth(32))),
      { from: OPERATOR, to: A.stakingVault, data: staking.encodeFunctionData("approveStakeQuota", [[PUBKEY], [SIGNATURE], [eth(32)]]) },
    ]);
    push("first NAV update", [navUpdate()]);
    push("deposits settle", [settleDeposit(ALICE), settleDeposit(BOB)]);
    s = await read();
    const supply = s.vault.supply;
    say(`After the deposits: ${fmtEth(supply)} shares, ${fmtEth(s.safeWeth)} WETH in the Safe, quota ${fmtEth(s.staking.quota)}`);
    expect(sciAccounting(s).stakeAmount).toBe(eth(32));

    // --- 1. Stake: unwrap + stake + NAV update ---------------------------------------------
    let before = s;
    s = await run("STAKE 32", sciPlans.stake(s, eth(32)), before);
    expect(s.staking.staked - before.staking.staked).toBe(eth(32));
    expect(before.safeWeth - s.safeWeth).toBe(eth(32));

    // --- 2. Rewards arrive; claim sends them on ---------------------------------------------
    push("rewards arrive", [], { balances: { [A.stakingVault]: (await ethBalance(A.stakingVault)) + eth(1) } });
    s = await read();
    say(`\n1 ETH of rewards reaches the staking vault: claimable ${fmtEth(s.staking.claimableRewards)}`);
    expect(s.staking.claimableRewards > 0n).toBe(true);
    expect(sciAccounting(s).steps.map((step) => step.key)).toContain("claimRewards");
    before = s;
    const expectedSend = before.staking.claimableRewards + sciAccounting(before).yieldInSafe;
    s = await run("CLAIM REWARDS", sciPlans.claimRewards(s), before);
    expect(s.multisigEth - before.multisigEth).toBe(expectedSend);
    expect(s.staking.claimableRewards).toBe(0n);
    expect(s.safeEth < SCI.DUST).toBe(true);

    // --- 3. A validator exits; before its ETH arrives nothing may be updated ---------------
    push("operator attests the exit", [
      { from: OPERATOR, to: A.stakingVault, data: staking.encodeFunctionData("attestUnbondings", [[PUBKEY]]) },
    ]);
    s = await read();
    const midExit = sciAccounting(s);
    say(`\nExit attested, ETH not back yet: staked ${fmtEth(s.staking.staked)}, withdrawable ${fmtEth(s.staking.withdrawable)}, NAV held ${midExit.settle.navHeld}`);
    expect(midExit.settle.navHeld).toBe(true);
    expect(midExit.settle.updateNav).toBe(false);
    expect(midExit.steps.map((step) => step.key)).toEqual(["exitInFlight"]);
    expect(sciPlans.settle(s).problem).not.toBe("");
    // What the staking vault already shows as withdrawable stays put until the whole exit has landed.
    expect(sciPlans.withdrawPrincipal(s).problem).toContain("Not now");

    push("exited principal and more rewards arrive", [], {
      balances: { [A.stakingVault]: (await ethBalance(A.stakingVault)) + eth(32.5) },
    });
    s = await read();
    say(`32 ETH + 0.5 of rewards arrive: withdrawable ${fmtEth(s.staking.withdrawable)}, claimable ${fmtEth(s.staking.claimableRewards)}`);
    expect(s.staking.withdrawable).toBe(eth(32));
    before = s;
    const rewards = before.staking.claimableRewards;
    s = await run("WITHDRAW PRINCIPAL", sciPlans.withdrawPrincipal(s), before);
    expect(s.safeWeth - before.safeWeth).toBe(eth(32));
    expect(s.multisigEth - before.multisigEth).toBe(rewards + sciAccounting(before).yieldInSafe);
    expect(s.staking.withdrawable).toBe(0n);

    // --- 4. Lido: WETH to stETH --------------------------------------------------------------
    before = s;
    s = await run("LIDO DEPOSIT 10", sciPlans.lidoDeposit(s, eth(10)), before);
    expect(before.safeWeth - s.safeWeth).toBe(eth(10));
    expect(eth(10) - s.safeSteth < 10n).toBe(true);

    // --- 5. Yield that ends up counted as WETH (a sale that filled above 1:1) is settled out --
    push("0.3 WETH lands in the Safe", [
      { from: DONOR, to: A.weth, value: hex(eth(0.3)), data: weth.encodeFunctionData("deposit") },
      { from: DONOR, to: A.weth, data: weth.encodeFunctionData("transfer", [A.safe, eth(0.3)]) },
    ]);
    s = await read();
    say(`\n0.3 WETH of yield lands in the Safe: vault reads ${fmtEth(s.vault.totalNav!)} for ${fmtEth(s.vault.supply)} shares`);
    expect(sciAccounting(s).steps.map((step) => step.key)).toContain("settle");
    before = s;
    s = await run("SETTLE", sciPlans.settle(s), before);
    expect(s.multisigEth - before.multisigEth > eth(0.3) - SCI.DUST).toBe(true);

    // --- 6. More yield than the cap has left --------------------------------------------------
    push("6 ETH of rewards arrive", [], { balances: { [A.stakingVault]: (await ethBalance(A.stakingVault)) + eth(6) } });
    s = await read();
    before = s;
    const capLeft = s.allowance.available;
    const capped = sciPlans.claimRewards(s);
    s = await run("CLAIM REWARDS OVER THE CAP", capped, before);
    expect(capped.warning).toContain("stays in the Safe");
    expect(s.multisigEth - before.multisigEth).toBe(capLeft);
    expect(s.allowance.available).toBe(0n);
    expect(s.safeEth).toBe(before.staking.claimableRewards + before.safeEth - capLeft);
    expect(sciPlans.settle(s).problem).toContain("Nothing can go out right now");

    // --- 7. Thirty days later the cap is back and the rest goes -------------------------------
    push("30 days pass", [], { wait: 30 * 86400 + 60 });
    s = await read();
    say(`\n30 days later: cap left ${fmtEth(s.allowance.available)}, yield waiting ${fmtEth(sciAccounting(s).yieldInSafe)}`);
    before = s;
    s = await run("SETTLE AFTER THE REFILL", sciPlans.settle(s), before);
    expect(s.multisigEth - before.multisigEth > 0n).toBe(true);

    // --- A new depositor gets exactly one share per ETH --------------------------------------
    push("Carol requests 5", request(CAROL, eth(5)));
    // A request can only be settled against a NAV update that came after it.
    push("NAV update", [navUpdate()]);
    push("Carol settles", [settleDeposit(CAROL)]);
    const carol = await shares(CAROL);
    say(`\nCarol deposits 5 WETH and receives ${ethers.formatEther(carol)} shares`);
    expect(carol > eth(5) - SCI.DUST && carol < eth(5) + SCI.DUST).toBe(true);
    expect((await shares(ALICE)) - eth(40) < 10n).toBe(true);

    // --- 8. A redemption: the console funds the vault contract, the depositor is paid 1:1 -----
    const bobShares = await shares(BOB);
    push("Bob asks for all his shares back", [
      { from: BOB, to: A.fund, data: fund.encodeFunctionData("fundFlowsCall", [flows.encodeFunctionData("requestWithdraw", [bobShares])]) },
    ]);
    s = await read();
    const fundStep = sciAccounting(s).steps.find((step) => step.key === "fundRedemptions");
    say(`\nBob requests ${fmtEth(bobShares)} shares back: console asks for ${fmtEth(fundStep?.amount ?? 0n)} WETH in the vault contract`);
    expect(fundStep?.amount).toBeDefined();
    before = s;
    s = await run("FUND REDEMPTIONS", sciPlans.fundRedemptions(s, fundStep!.amount!), before);
    const wethOf = async (who: string) =>
      BigInt((await replay([{ from: VIEWER, to: A.weth, data: erc20.encodeFunctionData("balanceOf", [who]) }]))[0]);
    const bobBefore = await wethOf(BOB);
    push("Bob withdraws", [
      { from: BOB, to: A.fund, data: fund.encodeFunctionData("fundFlowsCall", [flows.encodeFunctionData("withdraw")]) },
    ]);
    const bobPaid = (await wethOf(BOB)) - bobBefore;
    s = await read();
    say(`  Bob is paid ${ethers.formatEther(bobPaid)} WETH for ${ethers.formatEther(bobShares)} shares`
      + ` | vault reports ${fmtEth(s.vault.totalNav!)} ETH for ${fmtEth(s.vault.supply)} shares`);
    expect(bobPaid - bobShares > -SCI.DUST && bobPaid - bobShares < SCI.DUST).toBe(true);
    const offAfterRedeem = s.vault.totalNav! - s.vault.supply;
    expect(offAfterRedeem > -SCI.DUST && offAfterRedeem < SCI.DUST).toBe(true);
    expect(sciAccounting(s).steps.map((step) => step.key)).not.toContain("fundRedemptions");

    // --- 9. Selling stETH: the approval and the on-chain order signature pass the role ---------
    const order = { sellAmount: eth(5), buyAmount: eth(4.95), validTo: clock + 12 + 30 * 60 };
    const uid = cowOrderUid(order);
    const signed = async () =>
      BigInt((await replay([{ from: VIEWER, to: A.cowSettlement, data: settlement.encodeFunctionData("preSignature", [uid]) }]))[0]);
    push("APPROVE + SIGN A stETH SALE", [
      asExecutor(sciCalls.approveCow(order.sellAmount)),
      asExecutor(sciCalls.signCowOrder(order, cowValidDuration(order, clock + 12))),
    ]);
    expect(await signed()).not.toBe(0n);
    s = await read();
    expect(s.stethCowAllowance).toBe(eth(5));
    push("CANCEL THE SALE", [asExecutor(sciCalls.unsignCowOrder(order))]);
    expect(await signed()).toBe(0n);
    say("\nstETH sale: approve 5 stETH to the CoW relayer, sign the order on chain (pre-signature set), cancel it (cleared): all pass the role");
  }, 600_000);
});
