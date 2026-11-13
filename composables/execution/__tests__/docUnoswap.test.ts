import { ethers } from "ethers";
import { describe, expect, it, vi } from "vitest";

import {
  DOC,
  DOC_POOLS,
  DOC_TOKENS,
  DOC_UNOSWAP_RULES,
  HOP_TOKENS,
  describeDexWord,
  dexWord,
  encodeUnoswap,
  readDocUnoswapGrant,
  routeCandidates,
  validateDocUnoswap,
} from "../docConsole";
import { buildDocUnoswapProposal } from "../docProposal";
import { rolesV1ScopeInterface } from "../indefiProposal";
import { WETH_UNWRAP_FLAG, unoswapInterface, wordHex } from "../onchainSwap";
import { ParamComparison } from "~/types/enums/zodiac-roles";

const mocks = vi.hoisted(() => ({ fetchOnChainRolesV1: vi.fn() }));
vi.mock("~/services/onchain/rolesV1", () => ({ fetchOnChainRolesV1: mocks.fetchOnChainRolesV1 }));

const token = (symbol: string) => DOC_TOKENS.find((t) => t.symbol === symbol)!;
const pool = (a: string, b: string) =>
  DOC_POOLS.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))!;
const addressOf = (symbol: string) => token(symbol)?.address ?? HOP_TOKENS[symbol];
const word = (sell: string, buy: string) =>
  dexWord(pool(sell, buy).address, addressOf(sell), addressOf(buy));
const AMOUNT = ethers.parseUnits("100", 18);

describe("the whitelist rules", () => {
  const rules = DOC_UNOSWAP_RULES;

  it("sell only the four vault assets, to the Safe", () => {
    expect(rules.safeWord).toBe(wordHex(DOC.ADDR.safe));
    expect(rules.tokenWords).toEqual(DOC_TOKENS.map((t) => wordHex(t.address)));
    expect(rules.tokenWords).toHaveLength(4);
  });

  it("split the pool words by slot so a trade always ends in a vault asset", () => {
    const vault = DOC_TOKENS.map((t) => t.symbol);
    const hops = Object.keys(HOP_TOKENS);
    for (const w of rules.directWords) {
      const hop = describeDexWord(w)!;
      expect(vault).toContain(hop.sell);
      expect(vault).toContain(hop.buy);
    }
    for (const w of rules.firstHopWords) {
      const hop = describeDexWord(w)!;
      expect(vault).toContain(hop.sell);
      expect(hops).toContain(hop.buy);
    }
    for (const w of rules.secondHopWords) {
      const hop = describeDexWord(w)!;
      expect(hops).toContain(hop.sell);
      expect(vault).toContain(hop.buy);
    }
    // 4 vault/vault pools both ways; 9 vault/hop pools each way.
    expect(rules.directWords).toHaveLength(8);
    expect(rules.firstHopWords).toHaveLength(9);
    expect(rules.secondHopWords).toHaveLength(9);
    const all = [...rules.directWords, ...rules.firstHopWords, ...rules.secondHopWords];
    expect(new Set(all).size).toBe(all.length);
  });

  it("never list the hop-to-hop pool", () => {
    const w = word("USDC.e", "USDC");
    expect(describeDexWord(w)).not.toBeNull();
    for (const set of [rules.directWords, rules.firstHopWords, rules.secondHopWords]) {
      expect(set).not.toContain(w);
    }
  });
});

describe("validateDocUnoswap", () => {
  it("passes every route the console can build", () => {
    for (const sell of DOC_TOKENS) {
      for (const buy of DOC_TOKENS) {
        if (sell === buy) continue;
        const routes = routeCandidates(sell.symbol, buy.symbol);
        expect(routes.length).toBeGreaterThan(0);
        for (const route of routes) {
          const data = encodeUnoswap(route, sell, AMOUNT, 1n);
          expect(validateDocUnoswap(data, { sell, buy, amount: AMOUNT })).toEqual([]);
        }
      }
    }
  });

  const head = (sell = "DAI") => [BigInt(DOC.ADDR.safe), BigInt(addressOf(sell)), AMOUNT, 1n];
  const intent = (sell: string, buy: string) => ({ sell: token(sell), buy: token(buy), amount: AMOUNT });

  it("refuses a direct swap that ends in a hop token", () => {
    const data = unoswapInterface.encodeFunctionData("unoswapTo", [...head(), word("DAI", "USDC.e")]);
    const problems = validateDocUnoswap(data, intent("DAI", "WETH"));
    expect(problems.join(" ")).toMatch(/not allowed as dex\./);
    expect(problems.join(" ")).toMatch(/ends in USDC\.e/);
  });

  it("refuses a two-hop swap whose second hop stays in a hop token", () => {
    const data = unoswapInterface.encodeFunctionData("unoswapTo2", [
      ...head(),
      word("DAI", "USDC.e"),
      word("USDC.e", "USDC"),
    ]);
    const problems = validateDocUnoswap(data, intent("DAI", "WETH"));
    expect(problems.join(" ")).toMatch(/not allowed as dex2/);
  });

  it("refuses a direct-pool word in the second-hop slot, and hops that do not connect", () => {
    const data = unoswapInterface.encodeFunctionData("unoswapTo2", [
      ...head(),
      word("DAI", "USDC.e"),
      word("WETH", "WBTC"),
    ]);
    const problems = validateDocUnoswap(data, intent("DAI", "WBTC"));
    expect(problems.join(" ")).toMatch(/not allowed as dex2/);
    expect(problems.join(" ")).toMatch(/do not connect/);
  });

  it("refuses proceeds anywhere but the Safe, selling a hop token, an unwrap flag and a zero floor", () => {
    const elsewhere = unoswapInterface.encodeFunctionData("unoswapTo", [
      BigInt("0x000000000000000000000000000000000000bEEF"),
      BigInt(addressOf("DAI")),
      AMOUNT,
      1n,
      word("DAI", "WETH"),
    ]);
    expect(validateDocUnoswap(elsewhere, intent("DAI", "WETH")).join(" ")).toMatch(/land in the Safe/);

    const sellHop = unoswapInterface.encodeFunctionData("unoswapTo", [...head("USDC.e"), word("USDC.e", "WETH")]);
    expect(validateDocUnoswap(sellHop, intent("DAI", "WETH")).join(" ")).toMatch(/does not allow selling/);

    const unwrap = unoswapInterface.encodeFunctionData("unoswapTo", [...head(), word("DAI", "WETH") | WETH_UNWRAP_FLAG]);
    expect(validateDocUnoswap(unwrap, intent("DAI", "WETH")).join(" ")).toMatch(/not on the whitelist/);

    const free = unoswapInterface.encodeFunctionData("unoswapTo", [BigInt(DOC.ADDR.safe), BigInt(addressOf("DAI")), AMOUNT, 0n, word("DAI", "WETH")]);
    expect(validateDocUnoswap(free, intent("DAI", "WETH")).join(" ")).toMatch(/minReturn is zero/);
  });

  it("refuses the aggregator entry point outright", () => {
    expect(validateDocUnoswap("0x07ed2379" + "00".repeat(64), intent("DAI", "WETH"))[0]).toMatch(/Not an unoswapTo call/);
  });

  it("catches calldata built for a different leg", () => {
    const data = encodeUnoswap(routeCandidates("DAI", "WETH")[0], token("DAI"), AMOUNT, 1n);
    expect(validateDocUnoswap(data, intent("DAI", "WBTC")).join(" ")).toMatch(/ends in WETH, not WBTC/);
    expect(validateDocUnoswap(data, { ...intent("DAI", "WETH"), amount: AMOUNT * 2n }).join(" ")).toMatch(/not the amount planned/);
  });
});

describe("readDocUnoswapGrant", () => {
  /** The modifier as the replay would report it once the proposal's calls have executed. */
  const granted = () => {
    const functions = new Map<string, any>();
    for (const call of buildDocUnoswapProposal()) {
      const d = rolesV1ScopeInterface.parseTransaction({ data: call.data })!;
      if (d.name === "scopeRevokeFunction") continue;
      const sighash = String(d.args.functionSig).toLowerCase();
      const fn = functions.get(sighash) ?? { sighash, wildcarded: false, parameters: [] as any[] };
      fn.parameters.push(
        d.name === "scopeParameter"
          ? { index: Number(d.args.paramIndex), comparison: ParamComparison.EQUAL_TO, comparisonValue: [String(d.args.compValue).toLowerCase()] }
          : { index: Number(d.args.paramIndex), comparison: ParamComparison.ONE_OF, comparisonValue: [...d.args.compValues].map((v: string) => v.toLowerCase()) },
      );
      functions.set(sighash, fn);
    }
    return {
      roles: [
        { name: "1", targets: [{ address: DOC.ADDR.oneInch.toLowerCase(), functions: [...functions.values()] }] },
      ],
    };
  };

  it("reads the proposal's own outcome as granted", async () => {
    mocks.fetchOnChainRolesV1.mockResolvedValueOnce(granted());
    expect(await readDocUnoswapGrant()).toBe("granted");
  });

  it("reads today's modifier — swap() only — as missing", async () => {
    mocks.fetchOnChainRolesV1.mockResolvedValueOnce({
      roles: [
        {
          name: "1",
          targets: [
            {
              address: DOC.ADDR.oneInch.toLowerCase(),
              functions: [{ sighash: "0x07ed2379", wildcarded: false, parameters: [] }],
            },
          ],
        },
      ],
    });
    expect(await readDocUnoswapGrant()).toBe("missing");
    mocks.fetchOnChainRolesV1.mockResolvedValueOnce(null);
    expect(await readDocUnoswapGrant()).toBe("missing");
  });

  it("reads a scope with one pool word short, or wildcarded, as different", async () => {
    const short = granted();
    const to2 = short.roles[0].targets[0].functions.find((f: any) => f.parameters.some((p: any) => p.index === 5))!;
    to2.parameters.find((p: any) => p.index === 5).comparisonValue.pop();
    mocks.fetchOnChainRolesV1.mockResolvedValueOnce(short);
    expect(await readDocUnoswapGrant()).toBe("different");

    const wild = granted();
    wild.roles[0].targets[0].functions[0].wildcarded = true;
    mocks.fetchOnChainRolesV1.mockResolvedValueOnce(wild);
    expect(await readDocUnoswapGrant()).toBe("different");
  });

  it("reports an unreadable log as unreachable, never as missing", async () => {
    mocks.fetchOnChainRolesV1.mockRejectedValueOnce(new Error("no source answered"));
    expect(await readDocUnoswapGrant()).toBe("unreachable");
  });
});
