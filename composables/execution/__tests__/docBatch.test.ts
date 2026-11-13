import { ethers } from "ethers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOC,
  DOC_MULTISEND,
  DOC_TOKENS,
  docInner,
  encodeDocBatch,
  encodeUnoswap,
  routeCandidates,
  sequenceDocPlan,
  unpackDocBatch,
  type DocLeg,
} from "../docConsole";
import { parseUnoswap } from "../onchainSwap";

const mocks = vi.hoisted(() => ({ rpcRequestOn: vi.fn() }));
vi.mock("../rpc", () => ({ rpcRequestOn: mocks.rpcRequestOn }));

const token = (symbol: string) => DOC_TOKENS.find((t) => t.symbol === symbol)!;
const DAI = token("DAI");
const WETH = token("WETH");
const PAXG = token("PAXG");
const word = (v: bigint) => ethers.zeroPadValue(ethers.toBeHex(v), 32);

/** What eth_simulateV1 answers: one block, one result per call. */
const simulated = (calls: { ok: boolean; value?: bigint }[]) => [
  { calls: calls.map((c) => ({ status: c.ok ? "0x1" : "0x0", returnData: c.ok ? word(c.value ?? 0n) : "0x" })) },
];

/**
 * Answer every simulation the sequencer asks for: the earlier calls pass, and
 * the last one — the leg being priced — gets whatever `answer` says for it.
 */
const answerLast = (answer: (call: { to: string; data: string }, requestCalls: any[]) => { ok: boolean; value?: bigint }) =>
  mocks.rpcRequestOn.mockImplementation((_chain: unknown, _method: string, params: any[]) => {
    const calls = params[0].blockStateCalls[0].calls;
    return Promise.resolve(
      simulated(calls.map((c: any, i: number) => (i === calls.length - 1 ? answer(c, calls) : { ok: true, value: 1n }))),
    );
  });
const isUnoswap = (data: string) => data.startsWith("0xe2c95c82") || data.startsWith("0xea76dddf");
const isBalanceOf = (data: string) => data.startsWith("0x70a08231");

const swapLeg = (sell: string, buy: string, amountIn: bigint, sellPrice: number, buyPrice: number): DocLeg => {
  const route = routeCandidates(sell, buy)[0];
  return {
    kind: "swap",
    inner: docInner.unoswap(token(sell), token(buy), { route, amountIn, amountOut: 1n, slippagePct: 0 }, 1n),
    swap: { route, sell: token(sell), buy: token(buy), amountIn, sellPrice, buyPrice },
  };
};

describe("encodeDocBatch", () => {
  it("delegatecalls the modifier's MultiSend with every leg packed as a plain call", () => {
    const calls = [
      { to: DOC.ADDR.aavePool, data: docInner.aaveWithdraw(DAI, 10n ** 18n).data },
      { to: DOC.ADDR.oneInch, data: encodeUnoswap(routeCandidates("DAI", "WETH")[0], DAI, 10n ** 20n, 1n) },
    ];
    const batch = encodeDocBatch(calls);
    expect(batch.to).toBe(DOC_MULTISEND);
    expect(batch.operation).toBe(1);
    expect(batch.data.startsWith("0x8d80ff0a")).toBe(true); // multiSend(bytes)
    expect(unpackDocBatch(batch.data)).toEqual(calls.map((c) => ({ to: ethers.getAddress(c.to), data: c.data })));
  });
});

describe("sequenceDocPlan", () => {
  beforeEach(() => mocks.rpcRequestOn.mockReset());
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prices each swap at its place in the sequence and floors it by the tolerance", async () => {
    const amountIn = ethers.parseUnits("1000", 18);
    const out = ethers.parseUnits("0.4", 18); // 0.4 WETH for 1000 DAI at $2,500 = exactly fair
    answerLast(() => ({ ok: true, value: out }));
    const [leg] = await sequenceDocPlan([swapLeg("DAI", "WETH", amountIn, 1, 2500)], 1);

    expect(leg.problem).toBeNull();
    expect(leg.quote!.amountOut).toBe(out);
    expect(leg.quote!.slippagePct).toBeCloseTo(0, 6);
    const call = parseUnoswap(leg.inner.data);
    expect(call.to).toBe(DOC.ADDR.safe);
    expect(call.amount).toBe(amountIn);
    expect(call.minReturn).toBe((out * 99n) / 100n);

    // The simulation ran the probe from the Safe with a floor of 1.
    const [method, params] = mocks.rpcRequestOn.mock.calls[0].slice(1);
    expect(method).toBe("eth_simulateV1");
    const probe = (params as any)[0].blockStateCalls[0].calls[0];
    expect(probe.from).toBe(DOC.ADDR.safe);
    expect(parseUnoswap(probe.data).minReturn).toBe(1n);
  });

  it("sizes the deposit so it still fits if every swap into it fills at its floor", async () => {
    const paxgIn = ethers.parseUnits("1", 18);
    const daiOut = ethers.parseUnits("3300", 18);
    const balanceThen = ethers.parseUnits("5000", 18);
    answerLast((call) => ({ ok: true, value: isBalanceOf(call.data) ? balanceThen : daiOut }));
    const legs: DocLeg[] = [
      swapLeg("PAXG", "DAI", paxgIn, 3300, 1),
      {
        kind: "aaveSupply",
        inner: docInner.aaveSupply(DAI, ethers.parseUnits("6000", 18)),
        supply: { token: DAI, planned: ethers.parseUnits("6000", 18) },
      },
    ];
    const [swap, supply] = await sequenceDocPlan(legs, 1);
    expect(swap.problem).toBeNull();
    // The probe in the deposit's place read the DAI balance, after the chosen swap.
    const lastRequest = mocks.rpcRequestOn.mock.calls[mocks.rpcRequestOn.mock.calls.length - 1][2][0].blockStateCalls[0].calls;
    expect(lastRequest).toHaveLength(2);
    expect(isUnoswap(lastRequest[0].data)).toBe(true);
    expect(lastRequest[1].to).toBe(DAI.address);
    expect(isBalanceOf(lastRequest[1].data)).toBe(true);

    const floorGap = daiOut - (daiOut * 99n) / 100n;
    const [, amount] = new ethers.Interface([
      "function supply(address,uint256,address,uint16)",
    ]).decodeFunctionData("supply", supply.inner.data);
    expect(amount).toBe(balanceThen - floorGap);
    expect(supply.problem).toBeNull();
  });

  it("never deposits more than the plan asked for", async () => {
    answerLast(() => ({ ok: true, value: ethers.parseUnits("9000", 18) }));
    const planned = ethers.parseUnits("100", 18);
    const [supply] = await sequenceDocPlan(
      [{ kind: "aaveSupply", inner: docInner.aaveSupply(DAI, planned), supply: { token: DAI, planned } }],
      1,
    );
    expect(supply.inner.data).toBe(docInner.aaveSupply(DAI, planned).data);
  });

  it("refuses a leg that would revert, prices past the tolerance, or leaves nothing to deposit", async () => {
    answerLast((call, calls) => {
      if (isBalanceOf(call.data)) return { ok: true, value: 0n };
      // The first leg (PAXG) reverts through every route; the DAI leg prices
      // 1000 DAI → 0.3 WETH at $2,500 = −25%.
      const selling = "0x" + call.data.slice(10 + 64 + 24, 10 + 128).toLowerCase();
      if (selling === PAXG.address.toLowerCase()) return { ok: false };
      return { ok: true, value: calls.length ? ethers.parseUnits("0.3", 18) : 0n };
    });
    const legs: DocLeg[] = [
      swapLeg("PAXG", "WETH", ethers.parseUnits("1", 18), 3300, 2500),
      swapLeg("DAI", "WETH", ethers.parseUnits("1000", 18), 1, 2500),
      {
        kind: "aaveSupply",
        inner: docInner.aaveSupply(DAI, 1n),
        supply: { token: DAI, planned: ethers.parseUnits("10", 18) },
      },
    ];
    const [reverts, tooCheap, empty] = await sequenceDocPlan(legs, 1);
    expect(reverts.problem).toMatch(/PAXG → WETH would revert/);
    expect(tooCheap.problem).toMatch(/-25\.00%.*past your 1% limit/);
    expect(empty.problem).toMatch(/no DAI to deposit/);
    expect(PAXG.symbol).toBe("PAXG");
  });

  it("takes the best listed route for each leg given the legs before it", async () => {
    const routes = routeCandidates("PAXG", "WETH");
    expect(routes.length).toBeGreaterThan(1);
    const [first, second] = routes;
    const amountIn = ethers.parseUnits("0.1", 18);
    const firstData = encodeUnoswap(first, PAXG, amountIn, 1n);
    const secondData = encodeUnoswap(second, PAXG, amountIn, 1n);
    // `first` pays well until it has been used once; then `second` is better.
    answerLast((call, calls) => {
      const firstUsed = calls.slice(0, -1).some((c: any) => c.data === firstData);
      if (call.data === firstData) return { ok: true, value: firstUsed ? 1n : 10n ** 17n * 2n };
      if (call.data === secondData) return { ok: true, value: 10n ** 17n };
      return { ok: true, value: 1n };
    });
    const legs = [swapLeg("PAXG", "WETH", amountIn, 4000, 2500), swapLeg("PAXG", "WETH", amountIn, 4000, 2500)];
    const [a, b] = await sequenceDocPlan(legs, 50);
    expect(a.quote!.route.label).toBe(first.label);
    expect(b.quote!.route.label).toBe(second.label);
  });

  it("falls back to a public endpoint when no app RPC serves the simulation", async () => {
    mocks.rpcRequestOn.mockRejectedValue(new Error("method not found"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ result: simulated([{ ok: true, value: ethers.parseUnits("0.4", 18) }]) }),
      } as any),
    );
    const [leg] = await sequenceDocPlan([swapLeg("DAI", "WETH", ethers.parseUnits("1000", 18), 1, 2500)], 1);
    expect(leg.problem).toBeNull();
    expect(String(fetchSpy.mock.calls[0][0])).toContain("publicnode");
    fetchSpy.mockRestore();
    expect(WETH.decimals).toBe(18);
  });
});
