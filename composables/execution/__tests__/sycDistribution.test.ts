import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import fixture from "./mock_data/syc_distribution.json";
import { SYC } from "~/composables/execution/sycConsole";
import {
  DIST_IF,
  SYC_DIST,
  buildMintCall,
  distributionProblems,
  distributionShortfall,
  parseDistribution,
  type SycDistributionChain,
} from "~/composables/execution/sycDistribution";

const e = (n: number) => ethers.parseEther(String(n));
const A = "0x1271836313a2B692858F96D88118176E72d9eD74";
const B = "0xC419021546FDfEa5e097Bd48951cF1c8ACF9769B";
const file = (over: Record<string, unknown> = {}, wallets?: unknown[]) =>
  JSON.stringify({
    kind: "syc-distribution",
    version: 1,
    generatedAt: "2026-11-16T12:00:00.000Z",
    chainId: 137,
    fund: SYC.ADDR.fund,
    roles: SYC.ADDR.roles,
    roleKey: "adminRole",
    supplyAtGeneration: e(1000).toString(),
    wallets: wallets ?? [
      { wallet: A, owed: e(900).toString(), minted: e(600).toString(), mint: e(300).toString() },
      { wallet: B, owed: e(50).toString(), minted: e(50).toString(), mint: "0" },
    ],
    total: e(300).toString(),
    ...over,
  });
const chain = (over: Partial<SycDistributionChain> = {}): SycDistributionChain => ({
  supply: e(1000),
  safeSni: e(2000),
  available: e(50_000),
  allowanceStored: true,
  nextRefill: 0n,
  finalized: true,
  ...over,
});
const NOW = Date.parse("2026-11-16T15:00:00.000Z");

describe("SYC distribution file", () => {
  it("reads a well-formed file", () => {
    const d = parseDistribution(file());
    expect(d.total).toBe(e(300));
    expect(d.rows.map((r) => r.mint)).toEqual([e(300), 0n]);
    expect(d.supplyAtGeneration).toBe(e(1000));
  });

  it.each([
    ["not JSON", "nope", /not JSON/],
    ["another kind of answer", file({ kind: "safe-batch" }), /not a distribution/],
    ["another chain", file({ chainId: 1 }), /different vault/],
    ["another vault", file({ fund: SYC.ADDR.safe }), /different vault/],
    ["another modifier", file({ roles: SYC.ADDR.fund }), /different vault/],
    ["another role", file({ roleKey: "defaultManagerRole" }), /different role/],
    ["no wallets", file({}, []), /no wallets/],
    ["a total that does not add up", file({ total: e(301).toString() }), /do not add up/],
    ["an amount above what is owed", file({}, [{ wallet: A, owed: e(900).toString(), minted: e(600).toString(), mint: e(301).toString() }]), /owed minus/],
    ["a wallet twice", file({ total: e(600).toString() }, [1, 2].map(() => ({ wallet: A, owed: e(900).toString(), minted: e(600).toString(), mint: e(300).toString() }))), /listed twice/],
    ["a bad address", file({}, [{ wallet: "0x1234", owed: "1", minted: "0", mint: "1" }]), /not an address/],
    ["the vault as a recipient", file({ total: "1" }, [{ wallet: SYC.ADDR.safe, owed: "1", minted: "0", mint: "1" }]), /vault itself/],
    ["a decimal amount", file({}, [{ wallet: A, owed: "1.5", minted: "0", mint: "1.5" }]), /whole number/],
    ["a negative amount", file({}, [{ wallet: A, owed: "-1", minted: "0", mint: "-1" }]), /whole number/],
  ])("refuses %s", (_name, text, message) => {
    expect(() => parseDistribution(text as string)).toThrow(message as RegExp);
  });

  it("reads the backend's answer, extra fields and all, and a week with nothing due", () => {
    const view = JSON.parse(file());
    const d = parseDistribution(JSON.stringify({ ...view, scannedToBlock: 97435253, wethWaiting: "0", mintable: false, signers: [A], warnings: [] }));
    expect(d.total).toBe(e(300));
    const settled = parseDistribution(file({ total: "0" }, [{ wallet: A, owed: "5", minted: "5", mint: "0" }]));
    expect(settled.total).toBe(0n);
  });

  it("builds fundFlowsCall(mintToMany) for the wallets that are due, in order", () => {
    const call = buildMintCall(parseDistribution(file()));
    expect(call.to).toBe(SYC.ADDR.fund);
    const [inner] = DIST_IF.fund.decodeFunctionData("fundFlowsCall", call.data);
    const [amounts, recipients] = DIST_IF.flows.decodeFunctionData("mintToMany", inner);
    expect([...amounts]).toEqual([e(300)]);
    expect([...recipients]).toEqual([A]);
    expect(inner.slice(0, 10)).toBe("0x9d2fa7c8");
    expect(call.data.slice(0, 10)).toBe("0xec68ac8d");
  });

  it("builds the same call as the weekly script wrote for the multisig", () => {
    const call = buildMintCall(parseDistribution(JSON.stringify(fixture.distribution)));
    expect(call.to).toBe(fixture.expected.to);
    expect(call.data).toBe(fixture.expected.data);
    expect(fixture.expected.value).toBe("0");
    expect(fixture.expected.operation).toBe(0);
    expect(fixture.expected.role).toBe(SYC_DIST.ROLE);
  });
});

describe("SYC distribution checks", () => {
  const d = parseDistribution(file());

  it("passes when the chain agrees with the file", () => {
    expect(distributionProblems(d, chain(), NOW)).toEqual([]);
    expect(distributionShortfall(d, chain())).toBe(0n);
  });

  it("stops on a vault that is not finalized", () => {
    expect(distributionProblems(d, chain({ finalized: false }), NOW).join(" ")).toMatch(/not finalized/);
  });

  it("stops when SYC was minted after the file was made", () => {
    expect(distributionProblems(d, chain({ supply: e(1300) }), NOW).join(" ")).toMatch(/minted since/);
  });

  it("stops on figures older than two days", () => {
    expect(distributionProblems(d, chain(), d.generatedAt + SYC_DIST.MAX_AGE_MS + 1).join(" ")).toMatch(/two days old/);
    expect(distributionProblems(d, chain(), d.generatedAt + SYC_DIST.MAX_AGE_MS)).toEqual([]);
  });

  it("stops when the allowance is missing or too small", () => {
    expect(distributionProblems(d, chain({ allowanceStored: false, available: 0n }), NOW).join(" ")).toMatch(/not stored/);
    expect(distributionProblems(d, chain({ available: e(299) }), NOW).join(" ")).toMatch(/covers 299 SYC and this mint needs 300/);
    expect(distributionProblems(d, chain({ available: e(300) }), NOW)).toEqual([]);
  });

  it("reports how much SNI the Safe would be short", () => {
    expect(distributionShortfall(d, chain({ safeSni: e(1250) }))).toBe(e(50));
    expect(distributionShortfall(d, chain({ safeSni: e(1300) }))).toBe(0n);
  });
});
