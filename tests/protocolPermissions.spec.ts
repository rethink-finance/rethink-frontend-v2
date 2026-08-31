import { getProtocolEntry } from "@rethink-finance/positions-registry";
import { ethers } from "ethers";
import { afterEach, describe, expect, it, vi } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  buildProtocolPermissionEntries,
  getActionHint,
  getActionWarning,
  getProtocolLogoUrl,
  getRegistryProtocols,
  getTokenLogoUrl,
  initProtocolSelections,
  applyGroupSelection,
  applyValueScopes,
  isSecondaryGroup,
  normalizeActionEnablement,
  viewValueScopes,
  listProtocolScopesToRevoke,
  listRegistryScopeUniverse,
  validateProtocolSelections,
  viewGroup,
  type IProtocolSelectionState,
} from "../composables/permissions/protocolPermissions";

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);
const ETHEREUM = "0x1" as any;
const ARBITRUM = "0xa4b1" as any;
const BASE = "0x2105" as any;
const POLYGON = "0x89" as any;
// Covered by the registry but not exposed in the app's ChainId enum yet —
// the descriptors must still derive cleanly for the day the app adds them.
const OPTIMISM = "10" as any;
const GNOSIS = "100" as any;
const ROLES_MOD = "0x111f164d91e3f8169a7043f7094f44af87fb7ca4";
const ROLE_KEY_BYTES = ethers.encodeBytes32String("defaulManagerRole");

const aaveArb1Data = getProtocolEntry(42161, "aave_v3")?.data as any;
const aaveEthData = getProtocolEntry(1, "aave_v3")?.data as any;
// The desired-state pipeline (processPermissions) normalizes target
// addresses to lowercase, so scope/target expectations compare in lowercase.
const ARB1_POOL = (aaveArb1Data.addresses.POOL as string).toLowerCase();
const ARB1_USDC = (
  aaveArb1Data.reserves.find((r: any) => r.symbol === "USDC").token as string
).toLowerCase();
const ARB1_DAI = (
  aaveArb1Data.reserves.find((r: any) => r.symbol === "DAI").token as string
).toLowerCase();
const ETH_STK_AAVE = (aaveEthData.addresses.STK_AAVE as string).toLowerCase();
const ETH_ABPT_V2 = (aaveEthData.addresses.ABPT_V2 as string).toLowerCase();
const ETH_A_ETH_AAVE = (
  aaveEthData.addresses.A_ETH_AAVE as string
).toLowerCase();
const ETH_CORE_POOL = (aaveEthData.markets.Core.pool as string).toLowerCase();
const ETH_PRIME_POOL = (aaveEthData.markets.Prime.pool as string).toLowerCase();
const ETH_ETHERFI_POOL = (
  aaveEthData.markets.EtherFi.pool as string
).toLowerCase();
const ETH_AAVE_TOKEN = (
  aaveEthData.delegateTargets.find((t: any) => t.symbol === "AAVE")
    .token as string
).toLowerCase();

// Compound v3 nests its token rows inside each comet, so these come out of
// the nested shape the alias scan has to reach.
const compoundEthData = getProtocolEntry(1, "compound_v3")?.data as any;
const ethComet = (symbol: string) =>
  compoundEthData.comets.find((c: any) => c.symbol === symbol);
const ETH_CUSDCV3 = (ethComet("cUSDCv3").address as string).toLowerCase();
const ETH_WETH = (
  ethComet("cWETHv3").borrowToken.address as string
).toLowerCase();

const SUPPLY_SELECTOR = ethers
  .id("supply(address,uint256,address,uint16)")
  .slice(0, 10);
const APPROVE_SELECTOR = ethers.id("approve(address,uint256)").slice(0, 10);
const DELEGATE_SELECTOR = ethers.id("delegate(address)").slice(0, 10);

const selectionWith = (
  targets: string[],
  enabled = true,
): IProtocolSelectionState[] => [
  {
    protocol: "aave_v3",
    enabled,
    actions: [{ action: "deposit", enabled: true, params: { targets } }],
  },
];

const ethSelection = (
  actions: IProtocolSelectionState["actions"],
): IProtocolSelectionState[] => [{ protocol: "aave_v3", enabled: true, actions }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRegistryProtocols", () => {
  it("derives the Aave v3 deposit+borrow controls on Arbitrum", () => {
    const protocols = getRegistryProtocols(ARBITRUM);
    expect(protocols).toHaveLength(1);
    const [aave] = protocols;
    expect(aave.protocol).toBe("aave_v3");
    expect(aave.label).toBe("Aave v3");
    expect(aave.actions.map((a) => a.action)).toEqual(["deposit", "borrow"]);

    for (const action of aave.actions) {
      // The reserved `caps` field must NOT surface as a control (SCHEMA.md).
      expect(action.fields.map((f) => f.key)).toEqual(["targets"]);
      const [targets] = action.fields;
      expect(targets.control).toBe("multi-select");
      expect(targets.optional).toBe(false);

      const values = (targets.options ?? []).map((o) => o.value);
      // Address aliases of listed symbols are deduplicated out of display.
      expect(values.some((v) => /^0x/.test(v))).toBe(false);
      expect(values).toContain("ETH");
      expect(values).toContain("USDC");
      expect(values.length).toBe(aaveArb1Data.reserves.length + 1);
    }

    const usdcOption = (aave.actions[0].fields[0].options ?? []).find(
      (o) => o.value === "USDC",
    );
    expect(usdcOption?.tokenAddress?.toLowerCase()).toBe(ARB1_USDC);
  });

  it("covers every registry chain with schema-derived deposit+borrow controls", () => {
    // chain → the native pseudo-asset its targets enum leads with.
    const chains: [any, string][] = [
      [BASE, "ETH"],
      [OPTIMISM, "ETH"],
      [GNOSIS, "XDAI"],
    ];
    for (const [chain, nativeKey] of chains) {
      const aave = getRegistryProtocols(chain).find(
        (p) => p.protocol === "aave_v3",
      )!;
      expect(aave.actions.map((a) => a.action)).toEqual(["deposit", "borrow"]);
      for (const action of aave.actions) {
        const values = (action.fields[0].options ?? []).map((o) => o.value);
        expect(values).toContain(nativeKey);
        expect(values.length).toBeGreaterThan(1);
      }
    }
  });

  it("renders Gnosis Spark's savings-only deposit, the registry's narrowed surface", () => {
    // The gno entry deliberately ships ONLY the sDAI savings path: every
    // SparkLend reserve there is frozen (registry schema note). One option,
    // and it is a cluster key rather than a token, so it carries no address.
    const spark = getRegistryProtocols(GNOSIS).find(
      (p) => p.protocol === "spark",
    )!;
    expect(spark.actions.map((a) => a.action)).toEqual(["deposit"]);
    const options = spark.actions[0].fields[0].options ?? [];
    expect(options.map((o) => o.value)).toEqual(["DSR_sDAI"]);
    expect(options[0].tokenAddress).toBeUndefined();
  });

  it("derives Spark's Ethereum actions, including the parameterless stake", () => {
    const spark = getRegistryProtocols(ETHEREUM).find(
      (p) => p.protocol === "spark",
    )!;
    expect(spark.label).toBe("Spark");
    expect(spark.actions.map((a) => a.action)).toEqual([
      "deposit",
      "borrow",
      "stake",
    ]);

    const deposit = spark.actions[0];
    expect(deposit.fields.map((f) => f.key)).toEqual(["targets"]);
    const values = (deposit.fields[0].options ?? []).map((o) => o.value);
    // Native, the six savings clusters, then every reserve — symbols only.
    expect(values.slice(0, 7)).toEqual([
      "ETH",
      "DSR_sDAI",
      "SKY_sUSDC",
      "SKY_sUSDS",
      "SKY_spETH",
      "SKY_spUSDC",
      "SKY_spUSDT",
    ]);
    expect(values.some((v) => /^0x/.test(v))).toBe(false);

    // The stake schema's only field is the reserved `cap`, so the action
    // renders with no controls at all rather than an input for a limit the
    // registry's v1 generators ignore.
    const stake = spark.actions[2];
    expect(stake.fields).toEqual([]);
  });

  it("derives Compound v3's markets and its optional token narrowing", () => {
    const compound = getRegistryProtocols(ETHEREUM).find(
      (p) => p.protocol === "compound_v3",
    )!;
    expect(compound.label).toBe("Compound v3");

    const deposit = compound.actions[0];
    expect(deposit.fields.map((f) => f.key)).toEqual(["targets", "tokens"]);
    const markets = deposit.fields[0];
    expect(markets.optional).toBe(false);
    expect((markets.options ?? []).map((o) => o.value)).toEqual([
      "cUSDCv3",
      "cWETHv3",
      "cUSDTv3",
      "cWstETHv3",
      "cUSDSv3",
      "cWBTCv3",
    ]);

    // The comet rows NEST the token rows the `tokens` enum aliases, so the
    // alias scan has to walk into them: without that, every address alias
    // survives as its own shortened-hex chip and no option resolves an icon.
    const tokens = deposit.fields[1];
    expect(tokens.control).toBe("multi-select");
    expect(tokens.optional).toBe(true);
    const tokenOptions = tokens.options ?? [];
    expect(tokenOptions.map((o) => o.value).some((v) => /^0x/.test(v))).toBe(
      false,
    );
    expect(tokenOptions.every((o) => o.tokenAddress)).toBe(true);
    expect(
      tokenOptions.find((o) => o.value === "WETH")?.tokenAddress?.toLowerCase(),
    ).toBe(ETH_WETH);
    // An optional field says so, because an empty one is not "nothing".
    expect(tokens.note).toContain("omits this setting");

    const borrow = compound.actions[1];
    const borrowOptions = borrow.fields[0].options ?? [];
    expect(borrowOptions.map((o) => o.value)).toEqual([
      "USDC",
      "WETH",
      "USDT",
      "wstETH",
      "USDS",
      "WBTC",
    ]);
    // Comet symbols alias their market contract, and that feeds the preview.
    expect(compound.addressLabels[ETH_CUSDCV3]).toBe("cUSDCv3");
  });

  it("derives all four Ethereum actions, including market, stake and delegate", () => {
    const [aave] = getRegistryProtocols(ETHEREUM);
    expect(aave.actions.map((a) => a.action)).toEqual([
      "deposit",
      "borrow",
      "stake",
      "delegate",
    ]);

    for (const action of ["deposit", "borrow"]) {
      const descriptor = aave.actions.find((a) => a.action === action)!;
      expect(descriptor.fields.map((f) => f.key)).toEqual(["market", "targets"]);
      const market = descriptor.fields[0];
      expect(market.control).toBe("single-select");
      const marketOptions = market.options ?? [];
      // The alias scan reads every data table (`markets` included, a record
      // of {name, pool} rows), so the three pool-address aliases fold into
      // their market names instead of surfacing as shortened duplicates.
      expect(marketOptions.map((o) => o.value)).toEqual([
        "Core",
        "Prime",
        "EtherFi",
      ]);
      expect(
        marketOptions
          .find((o) => o.value === "Core")
          ?.tokenAddress?.toLowerCase(),
      ).toBe(ETH_CORE_POOL);

      const targets = descriptor.fields[1];
      expect(targets.control).toBe("multi-select");
      const targetValues = (targets.options ?? []).map((o) => o.value);
      expect(targetValues).toContain("ETH");
      // Union of all three markets' reserves, one option per symbol.
      expect(targetValues).toHaveLength(aaveEthData.reserves.length + 1);
      expect(targetValues.some((v) => /^0x/.test(v))).toBe(false);
    }

    const stake = aave.actions.find((a) => a.action === "stake")!;
    expect(stake.fields.map((f) => f.key)).toEqual(["targets"]);
    const stakeOptions = stake.fields[0].options ?? [];
    // Underlying-address aliases fold into their symbols, and every symbol
    // resolves its token address for the icon lookup — including the
    // safety-module assets that live in `stakeTargets`, not `reserves`.
    expect(stakeOptions.map((o) => o.value)).toEqual(["AAVE", "ABPTV2", "GHO"]);
    expect(
      stakeOptions.find((o) => o.value === "ABPTV2")?.tokenAddress?.toLowerCase(),
    ).toBe(ETH_ABPT_V2);

    const delegate = aave.actions.find((a) => a.action === "delegate")!;
    expect(delegate.fields.map((f) => f.key)).toEqual(["targets", "delegatee"]);
    const delegateOptions = delegate.fields[0].options ?? [];
    expect(delegateOptions.map((o) => o.value)).toEqual([
      "AAVE",
      "stkAAVE",
      "aEthAAVE",
    ]);
    expect(
      delegateOptions
        .find((o) => o.value === "stkAAVE")
        ?.tokenAddress?.toLowerCase(),
    ).toBe(ETH_STK_AAVE);
    expect(
      delegateOptions
        .find((o) => o.value === "aEthAAVE")
        ?.tokenAddress?.toLowerCase(),
    ).toBe(ETH_A_ETH_AAVE);
    const delegatee = delegate.fields[1];
    expect(delegatee.control).toBe("text");
    expect(delegatee.optional).toBe(false);
    expect(delegatee.pattern).toBe("^0x[0-9a-fA-F]{40}$");

    // The same alias table feeds the generated-calls preview's labels.
    expect(aave.addressLabels[ETH_CORE_POOL]).toBe("Core");
    expect(aave.addressLabels[ETH_STK_AAVE]).toBe("stkAAVE");
  });

  it("returns nothing for chains the registry does not cover", () => {
    expect(getRegistryProtocols(POLYGON)).toEqual([]);
    expect(getRegistryProtocols("0x3e7" as any)).toEqual([]); // HyperEVM
  });
});

describe("action metadata", () => {
  it("has a hint for every registry action", () => {
    for (const chain of [ETHEREUM, ARBITRUM, BASE, OPTIMISM, GNOSIS]) {
      for (const protocol of getRegistryProtocols(chain)) {
        for (const action of protocol.actions) {
          expect(getActionHint(action.action), `${action.action} hint`).not.toBe(
            "",
          );
        }
      }
    }
  });

  it("marks delegation as governance-sensitive, per the registry schema notes", () => {
    expect(getActionWarning("delegate")).toContain("Governance-sensitive");
    expect(getActionWarning("deposit")).toBe("");
    const [aave] = getRegistryProtocols(ETHEREUM);
    const delegate = aave.actions.find((a) => a.action === "delegate")!;
    expect(delegate.warning).toBe(getActionWarning("delegate"));
  });
});

describe("field groups", () => {
  const groupsOf = (chain: any, protocol: string) =>
    getRegistryProtocols(chain).find((p) => p.protocol === protocol)!.groups;

  it("gives actions that offer the same assets one shared control", () => {
    // Aave's deposit and borrow offer the identical 67 assets and the same
    // three markets, and its stake and delegate sets are one small token
    // list, so seven schema fields render as four controls.
    const groups = groupsOf(ETHEREUM, "aave_v3");
    expect(
      groups.map((g) => [
        g.label,
        g.members.map((m) => `${m.action}.${m.key}`).join("+"),
      ]),
    ).toEqual([
      ["Market", "deposit.market+borrow.market"],
      ["Assets", "deposit.targets+borrow.targets"],
      // Named for the family rather than for whichever member was widest —
      // otherwise the card shows two controls both labelled "Assets".
      ["Stake & delegate", "stake.targets+delegate.targets"],
      ["Delegatee", "delegate.delegatee"],
    ]);
    expect(groups[1].options).toHaveLength(67);
  });

  it("merges across differing field keys but never across differing kinds", () => {
    // Compound's borrow targets are 6 of the 33 assets its deposit can take,
    // under a different field name — one asset list. Its deposit `targets`
    // are MARKETS over a disjoint set, so they stay their own control.
    const groups = groupsOf(ETHEREUM, "compound_v3");
    expect(
      groups.map((g) => [
        g.label,
        g.members.map((m) => `${m.action}.${m.key}`).join("+"),
      ]),
    ).toEqual([
      ["Markets", "deposit.targets"],
      ["Assets", "deposit.tokens+borrow.targets"],
    ]);

    const assets = groups[1];
    expect(assets.options).toHaveLength(33);
    expect(
      assets.options!.find((o) => o.value === "USDC")!.actions,
    ).toEqual(["deposit", "borrow"]);
    // Collateral-only assets advertise the narrower grant.
    expect(assets.options!.find((o) => o.value === "COMP")!.actions).toEqual([
      "deposit",
    ]);
  });

  it("merges staking and delegation, each token carrying only its own scopes", () => {
    // Aave's stake and delegate sets share AAVE, so they are one question
    // over one token list — and every token advertises which of the two it
    // accepts, so the union never offers stkAAVE to staking.
    const groups = groupsOf(ETHEREUM, "aave_v3");
    const tokens = groups.find((g) => g.label === "Stake & delegate")!;
    expect(tokens.noun).toBe("token");
    expect(
      tokens.options!.map((o) => [o.value, o.actions.join("+")]),
    ).toEqual([
      ["AAVE", "stake+delegate"],
      ["ABPTV2", "stake"],
      ["GHO", "stake"],
      ["stkAAVE", "delegate"],
      ["aEthAAVE", "delegate"],
    ]);
    // The delegatee address keeps its own input: a text field never merges
    // into a token picker.
    expect(groups.find((g) => g.label === "Delegatee")!.members).toHaveLength(1);
  });

  it("keeps the lending family on nesting, so markets never join assets", () => {
    // Only the positions family merges on overlap. Compound's deposit
    // targets are MARKETS and its borrow targets are assets — disjoint sets
    // under the same field name — and they stay two controls.
    const groups = groupsOf(ETHEREUM, "compound_v3");
    const markets = groups.find((g) => g.label === "Markets")!;
    expect(markets.members.map((m) => m.action)).toEqual(["deposit"]);
    expect(markets.options!.every((o) => o.value.startsWith("c"))).toBe(true);
  });

  it("fans one pick out to every action that accepts it, and no further", () => {
    const protocols = getRegistryProtocols(ETHEREUM);
    const spark = protocols.find((p) => p.protocol === "spark")!;
    const assets = spark.groups.find((g) => g.label === "Assets")!;
    const seeded = initProtocolSelections(protocols).find(
      (s) => s.protocol === "spark",
    )!;

    const picked = applyGroupSelection(spark, seeded, assets, [
      "USDC",
      "DSR_sDAI",
    ]);
    const params = (action: string) =>
      picked.actions.find((a) => a.action === action)!.params;
    // The savings cluster is not borrowable, so it reaches deposit only.
    expect(params("deposit")).toEqual({ targets: ["USDC", "DSR_sDAI"] });
    expect(params("borrow")).toEqual({ targets: ["USDC"] });
    expect(viewGroup(picked, assets).selected).toEqual(["DSR_sDAI", "USDC"]);
  });

  it("scopes one value at a time, leaving its neighbours alone", () => {
    const protocols = getRegistryProtocols(ETHEREUM);
    const aave = protocols[0];
    const assets = aave.groups.find((g) => g.label === "Assets")!;
    const seeded = initProtocolSelections(protocols)[0];
    const picked = applyGroupSelection(aave, seeded, assets, ["USDC", "WETH"]);

    // Picking an asset grants every scope it accepts…
    expect(
      viewValueScopes(picked, assets, "USDC").map((s) => [s.action, s.granted]),
    ).toEqual([
      ["deposit", true],
      ["borrow", true],
    ]);

    // …and one asset can then be narrowed without touching the other.
    const narrowed = applyValueScopes(aave, picked, assets, "USDC", ["deposit"]);
    const params = (action: string) =>
      narrowed.actions.find((a) => a.action === action)!.params;
    expect(params("deposit").targets).toEqual(["USDC", "WETH"]);
    expect(params("borrow").targets).toEqual(["WETH"]);
    // Still picked — a narrowed asset is granted, for what is left of it.
    expect(viewGroup(narrowed, assets).selected).toEqual(["WETH", "USDC"]);
    expect(
      viewValueScopes(narrowed, assets, "USDC").map((s) => s.granted),
    ).toEqual([true, false]);

    // Dropping the last scope drops the asset, and the control offers it
    // back with every scope it accepts.
    const dropped = applyValueScopes(aave, narrowed, assets, "USDC", []);
    expect(viewGroup(dropped, assets).selected).toEqual(["WETH"]);
    expect(
      viewValueScopes(dropped, assets, "USDC").map((s) => s.action),
    ).toEqual(["deposit", "borrow"]);
  });

  it("offers a value only the scopes its own schema accepts", () => {
    const protocols = getRegistryProtocols(ETHEREUM);
    const aave = protocols[0];
    const tokens = aave.groups.find((g) => g.label === "Stake & delegate")!;
    const seeded = initProtocolSelections(protocols)[0];
    const picked = applyGroupSelection(aave, seeded, tokens, [
      "AAVE",
      "ABPTV2",
      "stkAAVE",
    ]);

    // AAVE can be both; the other two can be exactly one each, so those are
    // the only switches the card may show for them.
    expect(viewValueScopes(picked, tokens, "AAVE").map((s) => s.action)).toEqual(
      ["stake", "delegate"],
    );
    expect(
      viewValueScopes(picked, tokens, "ABPTV2").map((s) => s.action),
    ).toEqual(["stake"]);
    expect(
      viewValueScopes(picked, tokens, "stkAAVE").map((s) => s.action),
    ).toEqual(["delegate"]);

    const params = (action: string) =>
      picked.actions.find((a) => a.action === action)!.params;
    expect(params("stake").targets).toEqual(["AAVE", "ABPTV2"]);
    expect(params("delegate").targets).toEqual(["AAVE", "stkAAVE"]);
  });

  it("marks staking and delegation as the card's side errand", () => {
    // The controls the card keeps behind a disclosure: every action reading
    // them is a side errand. Anything a deposit or borrow reads stays in the
    // open, however narrow it is.
    const groups = groupsOf(ETHEREUM, "aave_v3");
    expect(
      groups.filter(isSecondaryGroup).map((g) => g.label),
    ).toEqual(["Stake & delegate", "Delegatee"]);
    expect(
      groups.filter((g) => !isSecondaryGroup(g)).map((g) => g.label),
    ).toEqual(["Market", "Assets"]);

    // A protocol with no side errand hides nothing.
    expect(groupsOf(ETHEREUM, "compound_v3").some(isSecondaryGroup)).toBe(false);
  });

  it("treats an emptied grant as ungranted, not as an unfinished form", () => {
    // A control whose values ARE the grant reports nothing when it is empty:
    // Spark's stake farm takes no assets, so enabling Spark and picking no
    // reserves is a complete, compilable selection.
    const protocols = getRegistryProtocols(ETHEREUM);
    const seeded = initProtocolSelections(protocols).map((entry) =>
      entry.protocol === "spark" ? { ...entry, enabled: true } : entry,
    );
    expect(validateProtocolSelections(ETHEREUM, seeded, protocols)).toEqual([]);
    expect(
      buildProtocolPermissionEntries({
        chainId: ETHEREUM,
        rolesModAddress: ROLES_MOD,
        selections: seeded,
      }).selections,
    ).toEqual([{ protocol: "spark", action: "stake", params: {} }]);

    // With nothing left to grant at all, the protocol says so once.
    const stakeOff = seeded.map((entry) =>
      entry.protocol === "spark"
        ? {
          ...entry,
          actions: entry.actions.map((a) =>
            a.action === "stake" ? { ...a, enabled: false } : a,
          ),
        }
        : entry,
    );
    const issues = validateProtocolSelections(ETHEREUM, stakeOff, protocols);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      "Spark: select at least one asset to grant, or switch the protocol off.",
    );
  });

  it("keeps the enabled flag in step with what the grant actually holds", () => {
    // The flag toCompileSelections gates on is derived, never separately
    // steered: a stale `enabled: true` beside an empty required list used to
    // compile to a raw zod "Required" instead of a permission.
    const protocols = getRegistryProtocols(ARBITRUM);
    const [aave] = protocols;
    const stale: IProtocolSelectionState = {
      protocol: "aave_v3",
      enabled: true,
      actions: [
        { action: "deposit", enabled: true, params: { targets: [] } },
        { action: "borrow", enabled: false, params: { targets: ["USDC"] } },
      ],
    };
    const fixed = normalizeActionEnablement(aave, stale);
    expect(fixed.actions.map((a) => a.enabled)).toEqual([false, true]);

    // Both entry points normalize, so neither can act on the contradiction.
    const issues = validateProtocolSelections(ARBITRUM, [stale], protocols);
    expect(issues).toEqual([]);
    expect(
      buildProtocolPermissionEntries({
        chainId: ARBITRUM,
        rolesModAddress: ROLES_MOD,
        selections: [stale],
      }).selections,
    ).toEqual([
      { protocol: "aave_v3", action: "borrow", params: { targets: ["USDC"] } },
    ]);
  });

  it("puts a schema caution on the control it is about", () => {
    const spark = groupsOf(ETHEREUM, "spark");
    expect(spark[0].warning).toContain("cluster of contracts");

    // Delegation's caution lands on the token picker, not on the delegatee
    // input below it, and not at the top of the card.
    const aave = groupsOf(ETHEREUM, "aave_v3");
    expect(
      aave.find((g) => g.label === "Stake & delegate")!.warning,
    ).toContain("Governance-sensitive");
    expect(aave.find((g) => g.label === "Delegatee")!.warning).toBeUndefined();
    expect(aave.find((g) => g.label === "Assets")!.warning).toBeUndefined();
  });
});

describe("initProtocolSelections", () => {
  it("starts protocols off, and every asset-granted action with them", () => {
    // An action whose grant IS an asset list starts off: picking assets for
    // it is what switches it on. Only an action with nothing to pick —
    // Spark's stake farm — starts on, so enabling the protocol grants it.
    //
    // A scalar the SCHEMA defaults is seeded with that default (Aave's
    // market is ZodDefault("Core")). Seeding grants nothing on its own —
    // every `targets` list is still empty, so every action is still off —
    // it just settles which pool those assets would be granted on, which
    // is also what decides which of them are grantable at all.
    const selections = initProtocolSelections(getRegistryProtocols(ETHEREUM));
    expect(selections).toEqual([
      {
        protocol: "aave_v3",
        enabled: false,
        actions: [
          {
            action: "deposit",
            enabled: false,
            params: { market: "Core", targets: [] },
          },
          {
            action: "borrow",
            enabled: false,
            params: { market: "Core", targets: [] },
          },
          { action: "stake", enabled: false, params: { targets: [] } },
          { action: "delegate", enabled: false, params: { targets: [] } },
        ],
      },
      {
        protocol: "spark",
        enabled: false,
        actions: [
          { action: "deposit", enabled: false, params: { targets: [] } },
          { action: "borrow", enabled: false, params: { targets: [] } },
          // No renderable field, so nothing to seed and nothing to derive.
          { action: "stake", enabled: true, params: {} },
        ],
      },
      {
        protocol: "compound_v3",
        enabled: false,
        actions: [
          {
            action: "deposit",
            enabled: false,
            params: { targets: [], tokens: [] },
          },
          { action: "borrow", enabled: false, params: { targets: [] } },
        ],
      },
    ]);
  });

  it("compiles a seeded optional multi-select as OMITTED, not as empty", () => {
    // The form seeds every multi-select to []. For Compound's optional
    // `tokens` the two readings differ sharply: omitted means "every asset of
    // the selected markets", while a present-but-empty array is rejected
    // outright ("the selected token set must not be empty") — which used to
    // make the card's own default state uncompilable at save time, with no
    // validation issue to warn anyone first.
    const seeded = initProtocolSelections(getRegistryProtocols(ETHEREUM)).map(
      (entry) =>
        entry.protocol === "compound_v3"
          ? {
            ...entry,
            enabled: true,
            actions: entry.actions.map((action) =>
              action.action === "deposit"
                ? { ...action, params: { ...action.params, targets: ["cUSDCv3"] } }
                : { ...action, enabled: false },
            ),
          }
          : entry,
    );

    expect(validateProtocolSelections(ETHEREUM, seeded)).toEqual([]);
    const build = buildProtocolPermissionEntries({
      chainId: ETHEREUM,
      rolesModAddress: ROLES_MOD,
      selections: seeded,
    });
    expect(build.selections[0].params).toEqual({ targets: ["cUSDCv3"] });
    expect(build.entries.length).toBeGreaterThan(0);
    // The comet's whole asset set, not one token: base + every collateral.
    const cometTokens = ethComet("cUSDCv3");
    expect(build.targetAddresses.length).toBeGreaterThan(
      cometTokens.collateralTokens.length,
    );
  });
});

describe("validateProtocolSelections", () => {
  it("passes a disabled protocol and a valid selection", () => {
    expect(validateProtocolSelections(ARBITRUM, selectionWith([], false)))
      .toEqual([]);
    expect(validateProtocolSelections(ARBITRUM, selectionWith(["USDC", "ETH"])))
      .toEqual([]);
  });

  it("rejects an enabled protocol with no assets picked", () => {
    const issues = validateProtocolSelections(ARBITRUM, selectionWith([]));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("select at least one asset");
  });

  it("maps registry schema failures onto readable messages", () => {
    const issues = validateProtocolSelections(ARBITRUM, selectionWith(["DOGE"]));
    expect(issues).toHaveLength(1);
    expect(issues[0].protocol).toBe("aave_v3");
    expect(issues[0].message).toContain("Aave v3");
  });

  it("requires a market on Ethereum when a stored selection has none", () => {
    // The form itself seeds the schema's own ZodDefault ("Core"), so this
    // is the hand-built or pre-default draft: a required field genuinely
    // absent is still an error rather than something quietly filled in at
    // save time.
    const issues = validateProtocolSelections(
      ETHEREUM,
      ethSelection([
        { action: "deposit", enabled: true, params: { targets: ["USDC"] } },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Market is required");
  });

  it("offers only the assets the chosen market actually lists", () => {
    // The `targets` enum is the UNION of all three markets' reserves, and
    // which of them a pool holds is a generation-time rule, not a schema
    // one — picking a Core-only reserve under Prime used to compile to
    // "reserve not found" after the fact. compile() is asked instead, so
    // the list a creator reads is the list they can grant.
    const [assets] = getRegistryProtocols(ETHEREUM)
      .find((p) => p.protocol === "aave_v3")!
      .groups.filter((g) => g.label === "Assets");

    // Both members, as the merged Market control always writes them: an
    // option survives if ANY active member accepts it, so leaving one
    // member unset would read as "unnarrowed" and hide the whole point.
    const listedUnder = (market: string) =>
      viewGroup(
        ethSelection([
          { action: "deposit", enabled: true, params: { market, targets: [] } },
          { action: "borrow", enabled: true, params: { market, targets: [] } },
        ])[0],
        assets,
      ).options.map((option) => option.value);

    expect(assets.options).toHaveLength(67);
    expect(listedUnder("Core")).toHaveLength(67);
    expect(listedUnder("Prime")).toEqual([
      "ETH",
      "WETH",
      "wstETH",
      "USDC",
      "GHO",
      "sUSDe",
      "USDS",
      "rsETH",
      "tETH",
      "ezETH",
    ]);
    // EtherFi has no native path, so ETH goes too — the refinement that
    // used to surface as a validation error after the choice was made.
    expect(listedUnder("EtherFi")).toEqual(["USDC", "FRAX", "PYUSD", "weETH"]);
  });

  it("keeps a market change from stranding assets the new market lacks", () => {
    // Switching Core → Prime with Core-only reserves picked would compile
    // to "reserve not found" on a list the form has already stopped
    // showing. Normalization prunes to what the new market grants, and the
    // grant follows the pruning: USDC survives, USDT does not.
    const descriptor = getRegistryProtocols(ETHEREUM).find(
      (p) => p.protocol === "aave_v3",
    )!;
    const moved = normalizeActionEnablement(
      descriptor,
      ethSelection([
        {
          action: "deposit",
          enabled: true,
          params: { market: "Prime", targets: ["USDC", "USDT", "DAI"] },
        },
      ])[0],
    );
    expect(moved.actions[0].params.targets).toEqual(["USDC"]);
    expect(moved.actions[0].enabled).toBe(true);

    // And when nothing survives, the action it governed goes off with it
    // rather than standing on a list the market cannot grant.
    const emptied = normalizeActionEnablement(
      descriptor,
      ethSelection([
        {
          action: "deposit",
          enabled: true,
          params: { market: "EtherFi", targets: ["USDT", "DAI"] },
        },
      ])[0],
    );
    expect(emptied.actions[0].params.targets).toEqual([]);
    expect(emptied.actions[0].enabled).toBe(false);
  });

  it("drops a stored asset the chosen market cannot grant", () => {
    // ETH on EtherFi is the registry's native-path refinement: that market
    // has no WETH reserve. The form no longer OFFERS it there (see the
    // narrowing tests), so a selection holding it is a stale one — a draft
    // made under Core, then moved. It is pruned rather than compiled, and
    // what remains is an action with nothing granted, reported as such.
    const issues = validateProtocolSelections(
      ETHEREUM,
      ethSelection([
        {
          action: "deposit",
          enabled: true,
          params: { market: "EtherFi", targets: ["ETH"] },
        },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("select at least one asset to grant");
  });

  it("rejects a malformed delegatee through the schema's address pattern", () => {
    const issues = validateProtocolSelections(
      ETHEREUM,
      ethSelection([
        {
          action: "delegate",
          enabled: true,
          params: { targets: ["AAVE"], delegatee: "vitalik.eth" },
        },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("expected a 0x-prefixed 20-byte address");
  });
});

describe("buildProtocolPermissionEntries", () => {
  const build = () =>
    buildProtocolPermissionEntries({
      chainId: ARBITRUM,
      rolesModAddress: ROLES_MOD,
      selections: selectionWith(["USDC"]),
    });

  it("returns an empty build when nothing is enabled", () => {
    const empty = buildProtocolPermissionEntries({
      chainId: ARBITRUM,
      rolesModAddress: ROLES_MOD,
      selections: selectionWith(["USDC"], false),
    });
    expect(empty.entries).toEqual([]);
    expect(empty.targetAddresses).toEqual([]);
  });

  it("emits Roles V2 calldata on the shared manager role key", () => {
    const { entries, descriptions, targetAddresses, grantedScopes } = build();
    expect(entries.length).toBeGreaterThan(0);
    expect(descriptions).toHaveLength(entries.length);

    const parsedNames: string[] = [];
    for (const data of entries) {
      const parsed = rolesInterface.parseTransaction({ data });
      expect(parsed).not.toBeNull();
      parsedNames.push(parsed!.name);
      // Every call configures the same role the rest of the batch uses.
      expect(parsed!.args[0]).toBe(ROLE_KEY_BYTES);
    }
    expect(parsedNames).toContain("scopeTarget");
    expect(parsedNames).toContain("scopeFunction");
    // A fresh role: the wholesale-replace pipeline must emit no revokes.
    expect(parsedNames.some((name) => name.startsWith("revoke"))).toBe(false);

    expect(targetAddresses).toContain(ARB1_POOL);
    expect(targetAddresses).toContain(ARB1_USDC);
    expect(grantedScopes).toContainEqual({
      target: ARB1_POOL,
      selector: SUPPLY_SELECTOR,
    });
    expect(grantedScopes).toContainEqual({
      target: ARB1_USDC,
      selector: APPROVE_SELECTOR,
    });
  });

  it("compiles the full Ethereum action set into one role batch", () => {
    const { entries, grantedScopes, targetAddresses } =
      buildProtocolPermissionEntries({
        chainId: ETHEREUM,
        rolesModAddress: ROLES_MOD,
        selections: ethSelection([
          {
            action: "deposit",
            enabled: true,
            params: { market: "Core", targets: ["USDC", "ETH"] },
          },
          { action: "borrow", enabled: false, params: { targets: [] } },
          { action: "stake", enabled: true, params: { targets: ["AAVE"] } },
          {
            action: "delegate",
            enabled: true,
            params: {
              targets: ["AAVE"],
              delegatee: "0x849d52316331967b6ff1198e5e32a0eb168d039d",
            },
          },
        ]),
      });
    for (const data of entries) {
      const parsed = rolesInterface.parseTransaction({ data });
      expect(parsed).not.toBeNull();
      expect(parsed!.args[0]).toBe(ROLE_KEY_BYTES);
    }
    expect(targetAddresses).toContain(ETH_CORE_POOL);
    expect(targetAddresses).toContain(ETH_STK_AAVE);
    expect(grantedScopes.some((s) => s.target === ETH_STK_AAVE)).toBe(true);
  });

  it("is deterministic for identical selections", () => {
    expect(build().entries).toEqual(build().entries);
  });
});

describe("DefiLlama logo urls", () => {
  it("maps registry protocol keys onto llama slugs", () => {
    expect(getProtocolLogoUrl("aave_v3")).toBe(
      "https://icons.llamao.fi/icons/protocols/aave-v3?w=48&h=48",
    );
    // Unknown protocols derive their slug, so future registry entries
    // resolve without a frontend change.
    expect(getProtocolLogoUrl("pendle_v2")).toContain("/protocols/pendle-v2?");
  });

  it("builds token urls from chain + lowercased address, native at the zero address", () => {
    expect(
      getTokenLogoUrl(ARBITRUM, "0xAF88d065e77c8cC2239327C5EDb3A432268e5831"),
    ).toBe(
      "https://token-icons.llamao.fi/icons/tokens/42161/0xaf88d065e77c8cc2239327c5edb3a432268e5831?h=48&w=48",
    );
    expect(getTokenLogoUrl(ARBITRUM)).toContain(
      "/42161/0x0000000000000000000000000000000000000000?",
    );
    expect(getTokenLogoUrl("nonsense" as any, ARB1_USDC)).toBeUndefined();
  });
});

describe("authoritative revokes", () => {
  it("enumerates the full registry scope universe for the chain", () => {
    const universe = listRegistryScopeUniverse(ARBITRUM);
    expect(universe).toContainEqual({
      target: ARB1_POOL,
      selector: SUPPLY_SELECTOR,
    });
    expect(universe).toContainEqual({
      target: ARB1_DAI,
      selector: APPROVE_SELECTOR,
    });
  });

  it("revokes everything the current selection does not grant", () => {
    const buildResult = buildProtocolPermissionEntries({
      chainId: ARBITRUM,
      rolesModAddress: ROLES_MOD,
      selections: selectionWith(["USDC"]),
    });
    const toRevoke = listProtocolScopesToRevoke(ARBITRUM, buildResult);
    // Unselected reserves are taken back off the modifier…
    expect(toRevoke).toContainEqual({
      target: ARB1_DAI,
      selector: APPROVE_SELECTOR,
    });
    // …while everything granted right now is spared.
    for (const scope of buildResult.grantedScopes) {
      expect(toRevoke).not.toContainEqual(scope);
    }
  });

  it("enumerates defaulted markets and free-text delegatee on Ethereum", () => {
    // The universe fans out over scalar-enum fields (market is
    // ZodDefault-wrapped) and fills required free-text fields with a
    // placeholder (delegatee only ever lands in calldata conditions), so no
    // eth action is skipped any more and a narrowing re-save under-revokes
    // nothing. The spy must precede the first call — the universe is cached.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const universe = listRegistryScopeUniverse(ETHEREUM);

    // One variant per market value, unioned: all three pools are covered —
    // including EtherFi, whose native-ETH rejection (superRefine) is pruned
    // value-by-value instead of aborting the whole market.
    expect(universe).toContainEqual({
      target: ETH_CORE_POOL,
      selector: SUPPLY_SELECTOR,
    });
    expect(universe.some((s) => s.target === ETH_PRIME_POOL)).toBe(true);
    expect(universe.some((s) => s.target === ETH_ETHERFI_POOL)).toBe(true);

    // Free-text delegatee: compiled with a placeholder, which pins the
    // governance-token scopes without the placeholder leaking in as a target.
    expect(universe).toContainEqual({
      target: ETH_AAVE_TOKEN,
      selector: DELEGATE_SELECTOR,
    });
    expect(universe.some((s) => s.target === ETH_STK_AAVE)).toBe(true);
    expect(
      universe.some(
        (s) => s.target === "0x0000000000000000000000000000000000000001",
      ),
    ).toBe(false);

    const warned = warn.mock.calls.map((call) => String(call[0]));
    expect(
      warned.filter((message) => message.includes("cannot enumerate")),
    ).toEqual([]);
  });

  it("keeps every grantable eth permission revocable, protocol by protocol", () => {
    // The property the universe exists for: anything a creator can grant on
    // this chain must also be enumerable for revocation, or a later
    // narrowing re-save silently leaves it on the modifier. Driven off the
    // descriptors rather than a fixed list, so a protocol the registry adds
    // next is checked the moment it appears.
    //
    // Compound v3's deposit is why this is not just "maximise every field":
    // its optional `tokens` narrows the markets in `targets`, so the widest
    // grant OMITS it — maximising both at once cannot compile (no asset is
    // collateral of every comet), and enumerating only that variant left 12
    // scopes ungrantable-back, comet supply/withdraw among them.
    const universe = listRegistryScopeUniverse(ETHEREUM);
    const scopeKey = (scope: { target: string; selector: string }) =>
      `${scope.target.toLowerCase()}:${scope.selector.toLowerCase()}`;
    const universeKeys = new Set(universe.map(scopeKey));
    const delegatee = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

    let compilableGrants = 0;
    for (const descriptor of getRegistryProtocols(ETHEREUM)) {
      for (const action of descriptor.actions) {
        for (const omitOptional of [false, true]) {
          const params: Record<string, unknown> = {};
          for (const field of action.fields) {
            if (field.optional && omitOptional) continue;
            if (field.control === "multi-select") {
              params[field.key] = (field.options ?? []).map((o) => o.value);
            } else if (field.control === "single-select") {
              params[field.key] = (field.options ?? [])[0]?.value;
            } else if (field.control === "text") {
              params[field.key] = delegatee;
            }
          }
          const selections = getRegistryProtocols(ETHEREUM).map((entry) => ({
            protocol: entry.protocol,
            enabled: entry.protocol === descriptor.protocol,
            actions: entry.actions.map((candidate) => ({
              action: candidate.action,
              enabled: candidate.action === action.action,
              params: candidate.action === action.action ? params : {},
            })),
          }));

          let build;
          try {
            build = buildProtocolPermissionEntries({
              chainId: ETHEREUM,
              rolesModAddress: ROLES_MOD,
              selections,
            });
          } catch {
            // Not grantable through the form either — the same compile()
            // gate rejects it there, so nothing is owed a revoke path.
            continue;
          }
          compilableGrants += 1;
          const unrevocable = build.grantedScopes.filter(
            (scope) => !universeKeys.has(scopeKey(scope)),
          );
          expect(
            unrevocable,
            `${descriptor.protocol}.${action.action} (optional fields ${
              omitOptional ? "omitted" : "maximised"
            }) grants scopes the universe cannot revoke`,
          ).toEqual([]);
        }
      }
    }
    // Guards the loop itself: a descriptor shape change that compiled
    // nothing would otherwise pass this test vacuously.
    expect(compilableGrants).toBeGreaterThanOrEqual(17);
  });

  it("revokes the other markets and switched-off actions on an eth re-save", () => {
    // The under-revoke this suite used to document as a known gap: narrow a
    // save to Core-market USDC deposits and everything else the registry
    // could ever have granted — other markets, delegation — must be revoked.
    const buildResult = buildProtocolPermissionEntries({
      chainId: ETHEREUM,
      rolesModAddress: ROLES_MOD,
      selections: ethSelection([
        {
          action: "deposit",
          enabled: true,
          params: { market: "Core", targets: ["USDC"] },
        },
        { action: "borrow", enabled: false, params: { targets: [] } },
        { action: "stake", enabled: false, params: { targets: [] } },
        { action: "delegate", enabled: false, params: { targets: [] } },
      ]),
    });
    const toRevoke = listProtocolScopesToRevoke(ETHEREUM, buildResult);
    expect(toRevoke.some((s) => s.target === ETH_PRIME_POOL)).toBe(true);
    expect(toRevoke.some((s) => s.target === ETH_ETHERFI_POOL)).toBe(true);
    expect(toRevoke).toContainEqual({
      target: ETH_AAVE_TOKEN,
      selector: DELEGATE_SELECTOR,
    });
    for (const scope of buildResult.grantedScopes) {
      expect(toRevoke).not.toContainEqual(scope);
    }
  });
});
