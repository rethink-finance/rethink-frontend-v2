import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import {
  PERIPHERIES,
  SELECTORS,
  SNI,
  decodeBridge,
  fetchAcrossQuote,
  fmtEth,
  isMember,
  POLY,
  polyCalls,
  sniCalls,
  validateBridge,
  type AcrossQuote,
} from "../sniEthConsole";
import { SYC } from "../sycConsole";
import recorded from "./mock_data/snieth_role_txs.json";

const eth = (n: number | string) => ethers.parseEther(String(n));
const [latest, withDepositor] = [
  recorded.txs.find((t) => t.hash.startsWith("0xcb0be4ea"))!, // 2026-10-07 bridge, 0x767e
  recorded.txs.find((t) => t.hash.startsWith("0x0d4a9cfb"))!, // 2026-07-03 bridge, 0x10D8
];
const claimTx = recorded.txs.find((t) => t.hash.startsWith("0xd13f93b0"))!; // 2026-10-07 claim

/** The quote the 2026-10-07 bridge was built from, read back out of its calldata. */
const quoteOf = (data: string): AcrossQuote => {
  const w = (i: number) => BigInt("0x" + data.slice(10 + 64 * i, 10 + 64 * (i + 1)));
  return {
    inputAmount: w(3),
    outputAmount: w(5),
    feeTotal: w(3) - w(5),
    exclusiveRelayer: ethers.getAddress("0x" + w(7).toString(16).padStart(40, "0")),
    quoteTimestamp: Number(w(8)),
    fillDeadline: Number(w(9)),
    exclusivityDeadline: Number(w(10)),
    estimatedFillTimeSec: 5,
    minDeposit: 0n,
    isAmountTooLow: false,
  };
};

const word = (data: string, i: number) => "0x" + data.slice(10 + 64 * i, 10 + 64 * (i + 1));
const pad = (a: string) => ethers.zeroPadValue(a, 32).toLowerCase();

describe("sniETH claim", () => {
  it("is claimRewards() on the W3 staking vault, exactly as the 2026-10-07 claim", () => {
    const call = sniCalls.claim();
    expect(call.to).toBe(SNI.ADDR.stakingVault);
    expect(call.data).toBe(SELECTORS.claimRewards);
    expect(call.to.toLowerCase()).toBe(claimTx.to.toLowerCase());
    expect(call.data).toBe(claimTx.data);
  });
});

describe("sniETH bridge calldata", () => {
  it("rebuilds the 2026-10-07 bridge byte for byte from its quote", () => {
    const quote = quoteOf(latest.data);
    const call = sniCalls.bridge(PERIPHERIES[0], quote);
    expect(call.to.toLowerCase()).toBe(latest.to.toLowerCase());
    expect(call.data).toBe(latest.data);
    expect(call.value).toBe(latest.value);
  });

  it("passes validation on the executed history (both periphery kinds)", () => {
    for (const tx of [latest, withDepositor]) {
      const call = { to: tx.to, data: tx.data, value: tx.value };
      expect(validateBridge(call, tx.timeStamp)).toEqual([]);
    }
    expect(decodeBridge({ to: withDepositor.to, data: withDepositor.data, value: withDepositor.value }).depositor)
      .toBe(SNI.ADDR.safe);
  });

  // Pins as stored on the modifier (ScopeParameter events, role 1).
  const PINS: Record<string, Record<number, string>> = {
    noDepositor: { 1: pad(SNI.DEST.recipient), 2: pad(SNI.ADDR.weth), 4: pad(SNI.DEST.outputToken), 6: pad("0x89") },
    withDepositor: { 2: pad(SNI.DEST.recipient), 3: pad(SNI.ADDR.weth), 5: pad(SNI.DEST.outputToken), 7: pad("0x89") },
  };

  it.each(PERIPHERIES)("encodes every pinned parameter on $address", (periphery) => {
    const call = sniCalls.bridge(periphery, quoteOf(latest.data));
    expect(call.data.slice(0, 10)).toBe(SELECTORS[periphery.kind]);
    for (const [index, value] of Object.entries(PINS[periphery.kind])) {
      expect(word(call.data, Number(index))).toBe(value);
    }
    expect(word(call.data, 0)).toBe(pad(SNI.ADDR.spokePool));
    expect(validateBridge(call, latest.timeStamp)).toEqual([]);
  });
});

describe("sniETH bridge validation", () => {
  const quote = quoteOf(latest.data);
  const good = sniCalls.bridge(PERIPHERIES[0], quote);
  const now = latest.timeStamp;

  it("refuses a SpokePool the modifier would let through", () => {
    const evil = good.data.replace(
      SNI.ADDR.spokePool.slice(2).toLowerCase(),
      "000000000000000000000000000000000000dead",
    );
    expect(validateBridge({ ...good, data: evil }, now).join(" ")).toMatch(/spokePool/);
  });

  it("refuses a fee above 1%", () => {
    const call = sniCalls.bridge(PERIPHERIES[0], { ...quote, outputAmount: (quote.inputAmount * 98n) / 100n });
    expect(validateBridge(call, now).join(" ")).toMatch(/more than 1%/);
  });

  it("refuses a value that differs from the deposit", () => {
    expect(validateBridge({ ...good, value: "1" }, now).join(" ")).toMatch(/does not equal/);
  });

  it("refuses an expired quote", () => {
    expect(validateBridge(good, quote.fillDeadline).join(" ")).toMatch(/expired/);
  });

  it("refuses a target that is not a scoped periphery", () => {
    expect(validateBridge({ ...good, to: SNI.ADDR.spokePool }, now)[0]).toMatch(/not one of the Across peripheries/);
  });
});

describe("Across quote", () => {
  const response = (body: object, ok = true) =>
    (() => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
  const body = {
    spokePoolAddress: SNI.ADDR.spokePool,
    outputAmount: "6535771263399282553",
    totalRelayFee: { total: "497383374532000" },
    timestamp: "1795522355",
    fillDeadline: "1795529555",
    exclusiveRelayer: "0xFD03AbCAdaF3F930fA4E37Eb2f6ea3A44a41b7F0",
    exclusivityDeadline: 1795522535,
    estimatedFillTimeSec: 5,
    limits: { minDeposit: "294748756160249" },
    isAmountTooLow: false,
  };

  it("parses suggested-fees", async () => {
    const q = await fetchAcrossQuote(6536268646773814553n, response(body));
    expect(q.outputAmount).toBe(6535771263399282553n);
    expect(q.exclusivityDeadline).toBe(1795522535);
    expect(validateBridge(sniCalls.bridge(PERIPHERIES[0], q), 1795522400)).toEqual([]);
  });

  it("refuses a quote through another SpokePool", async () => {
    await expect(
      fetchAcrossQuote(eth(1), response({ ...body, spokePoolAddress: "0x000000000000000000000000000000000000dEaD" })),
    ).rejects.toThrow(/Not sending/);
  });

  it("surfaces an API error", async () => {
    await expect(fetchAcrossQuote(1n, response({ message: "Amount too low" }, false))).rejects.toThrow(/Amount too low/);
  });
});

describe("helpers", () => {
  it("knows the four role-1 members, case-insensitively", () => {
    expect(isMember("0xf0d92e2b30a2c99ef515a02cd28eff8d21b42f9f")).toBe(true);
    expect(isMember("0x0000000000000000000000000000000000000001")).toBe(false);
  });
  it("rounds ETH down", () => {
    expect(fmtEth(6536268646773814553n)).toBe("6.536268");
    expect(fmtEth(0n)).toBe("0");
  });
});

describe("Polygon defuse and move", () => {
  it("submits exactly scopeTarget + scopeFunction(swapOwner) through the factory", () => {
    const call = polyCalls.defusePermission();
    expect(call.to).toBe(POLY.ADDR.factory);
    expect(call.data.slice(0, 10)).toBe("0xf6f5cd60");
    const [inner] = new ethers.Interface(["function submitPermissions(bytes[])"]).decodeFunctionData("submitPermissions", call.data);
    expect(inner.map((d: string) => d.slice(0, 10))).toEqual([
      ethers.id("scopeTarget(uint16,address)").slice(0, 10),
      ethers.id("scopeFunction(uint16,address,bytes4,bool[],uint8[],uint8[],bytes[],uint8)").slice(0, 10),
    ]);
    expect(inner[1].toLowerCase()).toContain(POLY.ADDR.newOwner.slice(2).toLowerCase());
    expect(polyCalls.swapOwner().data.toLowerCase()).toContain(POLY.ADDR.newOwner.slice(2).toLowerCase());
    expect(polyCalls.swapOwner().data.slice(0, 10)).toBe("0xe318b52b");
  });
  it("moves WETH to the SYC vault's Safe, the one the SYC console manages", () => {
    expect(POLY.ADDR.newSafe).toBe(SYC.ADDR.safe);
    const call = polyCalls.moveWeth(5n);
    expect(call.to).toBe(POLY.ADDR.weth);
    expect(call.data.toLowerCase()).toContain(POLY.ADDR.newSafe.slice(2).toLowerCase());
  });
});
