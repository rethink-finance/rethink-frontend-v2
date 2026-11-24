import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  IF,
  SYC,
  SYC_TOKENS,
  buildApprove,
  buildCollect,
  buildDecreaseLiquidity,
  buildIncreaseLiquidity,
  buildOneInchSwap,
  buildSwap,
  swapCandidates,
  sycOneInchRoute,
  sycRoutesBetween,
  sycToken,
  sycValidate,
  type SycCall,
  type SycRole,
} from "../sycConsole";
import { buildUnoswap } from "../onchainSwap";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";

/**
 * A rehearsal on current Polygon state, off by default (it needs the network):
 *
 *   SYC_DRY_RUN=1 npx vitest run composables/execution/__tests__/sycConsole.dryrun.test.ts
 *
 * Nothing is sent. Every step is part of one eth_simulateV1 block on top of
 * the latest block, so approvals, swaps and the buyback budget carry from one
 * call to the next exactly as they would on chain. Every call is built by the
 * console, checked by its validator, and sent through the vault's real Roles
 * modifier (execTransactionWithRole, shouldRevert) from the real member
 * wallets. Simulated, because the Safe holds no WETH or USDC today: those two
 * balances (a storage override), and a USDC/SNI position minted by the Safe
 * itself, since no role may mint.
 */
const RPCS = ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org", "https://1rpc.io/matic"];
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

const A = SYC.ADDR;
const WETH = sycToken("WETH");
const USDC = sycToken("USDC");
const SNI = sycToken("SNI");
const EXECUTORS = ["0x8C2eb5359041d2d1Eb12866eC2111eC15eD81e8d", "0xf0d92E2B30A2c99ef515A02Cd28EfF8d21B42F9F"];
const BUYBACKERS = ["0x7859CC463D1eEC6448AFF371db3B23B05d02D7Cc", "0xb1C2B62CF20903335f7ABb1c5f0aa26405B31337"];
const STRANGER = "0x000000000000000000000000000000000000bEEF";
const ROLE_KEYS: Record<SycRole, string> = {
  executor: ethers.encodeBytes32String(SYC.ROLE),
  buyback: ethers.encodeBytes32String(SYC.BUYBACK_ROLE),
};
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const coder = ethers.AbiCoder.defaultAbiCoder();
const word = (v: bigint) => ethers.zeroPadValue(ethers.toBeHex(v), 32);
const balanceSlot = (holder: string, slot: number) => ethers.keccak256(coder.encode(["address", "uint256"], [holder, slot]));

interface Step {
  label: string;
  tx: { from: string; to: string; data: string };
  /** Expected outcome: "ok", or the ConditionViolation status / error name it must be refused with. */
  expect: "ok" | number | string;
}

const viaRole = (from: string, role: SycRole, call: SycCall, label: string, want: Step["expect"] = "ok", roleKey?: string): Step => {
  // A call the console would send must pass its own rules first.
  if (want === "ok") expect(sycValidate(call, role), label).toEqual([]);
  return {
    label,
    tx: {
      from,
      to: A.roles,
      data: rolesIface.encodeFunctionData("execTransactionWithRole", [call.to, 0n, call.data, 0, roleKey ?? ROLE_KEYS[role], true]),
    },
    expect: want,
  };
};
const read = (label: string, token: string): Step => ({
  label,
  tx: { from: STRANGER, to: token, data: IF.erc20.encodeFunctionData("balanceOf", [A.safe]) },
  expect: "ok",
});

const outcome = (call: any): "ok" | number | string => {
  if (call.status === "0x1") return "ok";
  const data: string = call.returnData && call.returnData !== "0x" ? call.returnData : call.error?.data ?? "";
  try {
    const err = rolesIface.parseError(data);
    if (err?.name === "ConditionViolation") return Number(err.args[0]);
    if (err) return err.name;
  } catch {
    /* not a Roles error */
  }
  return data.slice(0, 10) || call.error?.message || "reverted";
};

const simulate = async (steps: Step[], overrides: Record<string, unknown>) => {
  const [block] = await rpc("eth_simulateV1", [
    {
      blockStateCalls: [{ stateOverrides: overrides, calls: steps.map((s) => ({ ...s.tx, gas: "0x1c9c380" })) }],
      validation: false,
    },
    "latest",
  ]);
  return block.calls as any[];
};

const wethIn = (n: string) => ethers.parseEther(n);
const usdcIn = (n: string) => ethers.parseUnits(n, 6);

describe.skipIf(!process.env.SYC_DRY_RUN)("SYC console: dry run through the live modifier", () => {
  it("every built call passes the roles it should and fails the ones it should not", async () => {
    const overrides = {
      [WETH.address]: { stateDiff: { [balanceSlot(A.safe, 0)]: word(wethIn("2")) } },
      [USDC.address]: { stateDiff: { [balanceSlot(A.safe, 9)]: word(usdcIn("3000")) } },
    };
    const [exA, exB] = EXECUTORS;
    const [bbA, bbB] = BUYBACKERS;
    const route = sycOneInchRoute();
    const steps: Step[] = [];

    // Approvals, by the executor.
    for (const token of SYC_TOKENS) steps.push(viaRole(exA, "executor", buildApprove(token, A.router02), `approve ${token.symbol} → router02`));
    steps.push(viaRole(exA, "executor", buildApprove(WETH, A.oneInch), "approve WETH → 1inch"));
    steps.push(viaRole(exB, "executor", buildApprove(USDC, A.npm), "approve USDC → NPM (second executor)"));
    steps.push(viaRole(exB, "executor", buildApprove(SNI, A.npm), "approve SNI → NPM"));

    // Every swap candidate the console can choose, both venues.
    const sizes: Record<string, bigint> = { WETH: wethIn("0.01"), USDC: usdcIn("10"), SNI: ethers.parseEther("50") };
    for (const sell of SYC_TOKENS) {
      for (const buy of SYC_TOKENS) {
        if (sell === buy) continue;
        for (const { venue, route: r } of swapCandidates(sell, buy)) {
          const call = buildSwap(venue, { route: r, amountIn: sizes[sell.symbol], minReturn: 1n });
          steps.push(viaRole(exA, "executor", call, `${venue} ${sell.symbol}→${buy.symbol} ${r.hops.map((h) => h.pool.label).join(" + ")}`));
        }
      }
    }

    // The buyback: two buys that fill the day, then the budget holds for both members.
    const bbBefore = steps.length;
    steps.push(read("Safe SNI before buybacks", SNI.address));
    steps.push(read("Safe WETH before buybacks", WETH.address));
    steps.push(viaRole(bbA, "buyback", buildOneInchSwap({ route, amountIn: wethIn("0.06"), minReturn: 1n }), "buyback 0.06 WETH"));
    steps.push(viaRole(bbB, "buyback", buildOneInchSwap({ route, amountIn: wethIn("0.04"), minReturn: 1n }), "buyback 0.04 WETH (second member)"));
    steps.push(read("Safe SNI after buybacks", SNI.address));
    steps.push(read("Safe WETH after buybacks", WETH.address));
    steps.push(viaRole(bbA, "buyback", buildOneInchSwap({ route, amountIn: 1n, minReturn: 1n }), "buyback 1 wei over the day's budget", 17));
    steps.push(viaRole(bbB, "buyback", buildOneInchSwap({ route, amountIn: 1n, minReturn: 1n }), "second member, budget shared", 17));
    steps.push(viaRole(bbA, "buyback", buildOneInchSwap({ route, amountIn: wethIn("0.11"), minReturn: 1n }), "buyback above 0.1 WETH", 9));

    // What must be refused.
    const single = IF.router02.encodeFunctionData("exactInputSingle", [{ tokenIn: WETH.address, tokenOut: USDC.address, fee: 500, recipient: STRANGER, amountIn: 1n, amountOutMinimum: 1n, sqrtPriceLimitX96: 0n }]);
    steps.push(viaRole(exA, "executor", { to: A.router02, data: single }, "swap proceeds to a stranger", 7));
    steps.push(viaRole(exA, "executor", buildUnoswap({ safe: A.safe, route: sycRoutesBetween(SNI, WETH)[1], amountIn: 1n, minReturn: 1n }), "1inch reverse route", 7));
    steps.push(viaRole(exA, "executor", buildApprove(WETH, STRANGER), "approve to a stranger", 5));
    steps.push(viaRole(bbA, "buyback", buildApprove(WETH, A.oneInch), "buyback role approving", 2, ROLE_KEYS.buyback));
    steps.push(viaRole(bbA, "executor", buildApprove(WETH, A.oneInch), "buyback member using the executor key", "NoMembership"));
    steps.push(viaRole(exA, "buyback", buildOneInchSwap({ route, amountIn: 1n, minReturn: 1n }), "executor using the buyback key", "NoMembership"));
    steps.push(viaRole(STRANGER, "executor", buildApprove(WETH, A.router02), "stranger", "NotAuthorized"));

    const calls = await simulate(steps, overrides);
    expect(calls).toHaveLength(steps.length);
    const failures: string[] = [];
    steps.forEach((s, i) => {
      const got = outcome(calls[i]);
      if (got !== s.expect) failures.push(`${s.label}: expected ${s.expect}, got ${got}`);
      if (process.env.SYC_DRY_RUN_VERBOSE) console.log(`${got === s.expect ? "ok  " : "FAIL"} ${s.label} → ${got}`);
    });
    expect(failures).toEqual([]);

    const value = (label: string) => BigInt(calls[steps.findIndex((s) => s.label === label)].returnData);
    expect(value("Safe WETH before buybacks") - value("Safe WETH after buybacks")).toBe(SYC.BUYBACK_MAX);
    expect(value("Safe SNI after buybacks")).toBeGreaterThan(value("Safe SNI before buybacks"));
    expect(bbBefore).toBeGreaterThan(18);
  }, 120_000);

  it("positions the Safe owns can be added to, removed from and collected; a foreign one cannot", async () => {
    const overrides = { [USDC.address]: { stateDiff: { [balanceSlot(A.safe, 9)]: word(usdcIn("3000")) } } };
    const [exA] = EXECUTORS;
    const approvals = [
      viaRole(exA, "executor", buildApprove(USDC, A.npm), "approve USDC → NPM"),
      viaRole(exA, "executor", buildApprove(SNI, A.npm), "approve SNI → NPM"),
    ];
    // No role may mint: the Safe mints a full-range USDC/SNI position itself.
    const mintIface = new ethers.Interface([
      "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
    ]);
    const mint: Step = {
      label: "Safe mints a position",
      tx: {
        from: A.safe,
        to: A.npm,
        data: mintIface.encodeFunctionData("mint", [[USDC.address, SNI.address, 3000, -887220, 887220, usdcIn("100"), ethers.parseEther("400"), 0, 0, A.safe, 2n ** 40n]]),
      },
      expect: "ok",
    };
    const first = await simulate([...approvals, mint], overrides);
    expect(outcome(first[2])).toBe("ok");
    const [tokenId] = mintIface.decodeFunctionResult("mint", first[2].returnData);

    const deadline = 2n ** 40n;
    const steps: Step[] = [
      ...approvals,
      mint,
      viaRole(exA, "executor", buildIncreaseLiquidity({ tokenId, amount0Desired: usdcIn("10"), amount1Desired: ethers.parseEther("40"), amount0Min: 0n, amount1Min: 0n, deadline }), "increase the Safe's position"),
      viaRole(exA, "executor", buildDecreaseLiquidity({ tokenId, liquidity: 1000n, amount0Min: 0n, amount1Min: 0n, deadline }), "decrease the Safe's position"),
      viaRole(exA, "executor", buildCollect(tokenId), "collect the Safe's position"),
      viaRole(exA, "executor", buildIncreaseLiquidity({ tokenId: tokenId - 1n, amount0Desired: 1n, amount1Desired: 1n, amount0Min: 0n, amount1Min: 0n, deadline }), "increase someone else's position", 16),
      viaRole(exA, "executor", buildCollect(tokenId - 1n), "collect someone else's position", 16),
    ];
    const calls = await simulate(steps, overrides);
    expect(calls).toHaveLength(steps.length);
    const failures: string[] = [];
    steps.forEach((s, i) => {
      const got = outcome(calls[i]);
      if (got !== s.expect) failures.push(`${s.label}: expected ${s.expect}, got ${got}`);
      if (process.env.SYC_DRY_RUN_VERBOSE) console.log(`${got === s.expect ? "ok  " : "FAIL"} ${s.label} → ${got}`);
    });
    expect(failures).toEqual([]);
  }, 120_000);
});
