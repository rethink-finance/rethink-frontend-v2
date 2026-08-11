import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import { c, flattenCondition } from "zodiac-roles-sdk";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  ASSIGN_ROLES_SELECTOR,
  buildUpdateSettingsConditions,
  generateManageRoleMembersPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  type IUpdateSettingsPinnedValues,
  parseUpdateSettingsPinnedValues,
  RolesV2ExecutionOptions,
  RolesV2Operator,
  RolesV2ParameterType,
  TRANSFER_OWNERSHIP_SELECTOR,
  UPDATE_SETTINGS_SELECTOR,
} from "../composables/permissions/rolesV2Permissions";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

const FUND = "0x111f164d91e3F8169a7043f7094f44af87Fb7CA4";
const ROLES_MODIFIER = "0x583A40de5b558CC04EE50795f9425bfC141c9107";
const ROLE_KEY_BYTES = ethers.encodeBytes32String("defaulManagerRole");

const PINNED: IUpdateSettingsPinnedValues = {
  depositFee: 100n,
  withdrawFee: 0n,
  performanceFee: 2000n,
  managementFee: 100n,
  performaceHurdleRateBps: 0n,
  baseToken: "0x1111111111111111111111111111111111111111",
  safe: "0x2222222222222222222222222222222222222222",
  isExternalGovTokenInUse: false,
  isWhitelistedDeposits: true,
  governanceToken: "0x3333333333333333333333333333333333333333",
  fundAddress: "0x4444444444444444444444444444444444444444",
  fundName: "Fixture Fund",
  fundSymbol: "FIX",
  feeCollectors: [
    "0x5555555555555555555555555555555555555555",
    "0x6666666666666666666666666666666666666666",
    "0x7777777777777777777777777777777777777777",
    "0x8888888888888888888888888888888888888888",
  ],
  feePerformancePeriod: 90n,
  feeManagePeriod: 0n,
};

const encUint = (v: bigint) => abiCoder.encode(["uint256"], [v]);
const encAddr = (v: string) => abiCoder.encode(["address"], [v]);
const encBool = (v: boolean) => abiCoder.encode(["bool"], [v]);
const encString = (v: string) => abiCoder.encode(["string"], [v]);

const { Static, Dynamic, Tuple, Array: ArrayT, Calldata } = RolesV2ParameterType;
const { Pass, Matches, EqualTo } = RolesV2Operator;

describe("buildUpdateSettingsConditions", () => {
  const conditions = buildUpdateSettingsConditions(PINNED);

  it("matches the permission spec table node by node", () => {
    // [parent, paramType, operator, compValue]
    const expected: [number, number, number, string][] = [
      // calldata root over 4 params
      [0, Calldata, Matches, "0x"],
      // param 1: the Settings tuple
      [0, Tuple, Matches, "0x"],
      // param 2: _fundMetadata — wildcard
      [0, Dynamic, Pass, "0x"],
      // params 3/4: fee periods pinned
      [0, Static, EqualTo, encUint(90n)],
      [0, Static, EqualTo, encUint(0n)],
      // Settings tuple fields, in struct order
      [1, Static, EqualTo, encUint(100n)], // depositFee
      [1, Static, EqualTo, encUint(0n)], // withdrawFee
      [1, Static, EqualTo, encUint(2000n)], // performanceFee
      [1, Static, EqualTo, encUint(100n)], // managementFee
      [1, Static, EqualTo, encUint(0n)], // performaceHurdleRateBps
      [1, Static, EqualTo, encAddr(PINNED.baseToken)],
      [1, Static, EqualTo, encAddr(PINNED.safe)],
      [1, Static, EqualTo, encBool(false)], // isExternalGovTokenInUse
      // isWhitelistedDeposits — wildcard: the manager may turn whitelist
      // enforcement on and off
      [1, Static, Pass, "0x"],
      // allowedDepositAddrs — wildcard (whitelist management)
      [1, ArrayT, Pass, "0x"],
      // allowedManagers — pinned to the empty array
      [1, ArrayT, EqualTo, abiCoder.encode(["address[]"], [[]])],
      [1, Static, EqualTo, encAddr(PINNED.governanceToken)],
      [1, Static, EqualTo, encAddr(PINNED.fundAddress)],
      // governor — pinned to the SAFE (post-activation value)
      [1, Static, EqualTo, encAddr(PINNED.safe)],
      [1, Dynamic, EqualTo, encString("Fixture Fund")],
      [1, Dynamic, EqualTo, encString("FIX")],
      // feeCollectors address[4]: static fixed array == inline tuple of 4
      [1, Tuple, EqualTo, abiCoder.encode(["address[4]"], [PINNED.feeCollectors])],
      // structural children: array element templates + tuple members
      [14, Static, Pass, "0x"], // allowedDepositAddrs element
      [15, Static, Pass, "0x"], // allowedManagers element
      [21, Static, Pass, "0x"], // feeCollectors[0..3]
      [21, Static, Pass, "0x"],
      [21, Static, Pass, "0x"],
      [21, Static, Pass, "0x"],
    ];

    expect(conditions.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(conditions[i][0], `node ${i} parent`).toBe(expected[i][0]);
      expect(conditions[i][1], `node ${i} paramType`).toBe(expected[i][1]);
      expect(conditions[i][2], `node ${i} operator`).toBe(expected[i][2]);
      expect(
        conditions[i][3].toLowerCase(),
        `node ${i} compValue`,
      ).toBe(expected[i][3].toLowerCase());
    }
  });

  it("satisfies Integrity.enforce structural invariants", () => {
    // root: node 0 is its own parent, and the only such node
    expect(conditions[0][0]).toBe(0);
    expect(
      conditions.filter(([parent], i) => parent === i).length,
    ).toBe(1);
    for (let i = 1; i < conditions.length; i++) {
      // BFS: parents non-decreasing, and each parent precedes its child
      expect(conditions[i - 1][0]).toBeLessThanOrEqual(conditions[i][0]);
      expect(conditions[i][0]).toBeLessThan(i);
      // EqualTo compValues are non-empty multiples of 32 bytes
      const [, , operator, compValue] = conditions[i];
      if (operator === EqualTo) {
        const byteLength = (compValue.length - 2) / 2;
        expect(byteLength).toBeGreaterThan(0);
        expect(byteLength % 32).toBe(0);
      } else {
        expect(compValue).toBe("0x");
      }
    }
  });

  it("wildcards ONLY the whitelist fields and _fundMetadata", () => {
    // Every top-level Pass node must be one of the three allowed wildcards:
    // node 2 (_fundMetadata), node 13 (isWhitelistedDeposits) and node 14
    // (allowedDepositAddrs). All other Pass nodes are structural leaves
    // under Array/Tuple nodes.
    const passNodes = conditions
      .map((node, i) => [i, ...node] as const)
      .filter(([, , , operator]) => operator === Pass);
    const structuralParents = new Set([14, 15, 21]);
    for (const [i, parent] of passNodes) {
      if (i === 2 || i === 13 || i === 14) continue;
      expect(structuralParents.has(parent), `unexpected Pass at ${i}`).toBe(
        true,
      );
    }
  });

  it("cross-checks against zodiac-roles-sdk (devDependency)", () => {
    const SETTINGS_TYPE =
      "(uint256 depositFee, uint256 withdrawFee, uint256 performanceFee," +
      " uint256 managementFee, uint256 performaceHurdleRateBps," +
      " address baseToken, address safe, bool isExternalGovTokenInUse," +
      " bool isWhitelistedDeposits, address[] allowedDepositAddrs," +
      " address[] allowedManagers, address governanceToken," +
      " address fundAddress, address governor, string fundName," +
      " string fundSymbol, address[4] feeCollectors)";

    const sdkCondition = c.calldataMatches(
      [
        c.matches({
          depositFee: PINNED.depositFee,
          withdrawFee: PINNED.withdrawFee,
          performanceFee: PINNED.performanceFee,
          managementFee: PINNED.managementFee,
          performaceHurdleRateBps: PINNED.performaceHurdleRateBps,
          baseToken: PINNED.baseToken,
          safe: PINNED.safe,
          isExternalGovTokenInUse: PINNED.isExternalGovTokenInUse,
          isWhitelistedDeposits: undefined, // wildcard (manager-toggleable)
          allowedDepositAddrs: undefined, // wildcard
          allowedManagers: c.eq([]),
          governanceToken: PINNED.governanceToken,
          fundAddress: PINNED.fundAddress,
          governor: PINNED.safe,
          fundName: PINNED.fundName,
          fundSymbol: PINNED.fundSymbol,
          feeCollectors: c.eq(PINNED.feeCollectors),
        }),
        undefined, // _fundMetadata wildcard
        c.eq(PINNED.feePerformancePeriod),
        c.eq(PINNED.feeManagePeriod),
      ],
      [SETTINGS_TYPE, "string", "uint256", "uint256"],
    );
    const sdkFlat = flattenCondition(sdkCondition());

    // The SDK models address[4] as ParameterType.Array with one template
    // child. That is WRONG for the deployed v2.1 Decoder: an Array node is
    // decoded by reading its first word as the length, but a fixed-size
    // array is laid out as a static inline block with no length word (and
    // no offset pointer in the tuple head). Our encoder maps it to Tuple
    // with 4 Static children, which decodes identically to the actual
    // calldata layout. Everything else must match the SDK exactly,
    // including compValue bytes.
    expect(sdkFlat.length).toBe(25);
    expect(conditions.length).toBe(28);

    // Nodes 0..20 line up one-to-one (same BFS positions).
    for (let i = 0; i <= 20; i++) {
      expect(sdkFlat[i].parent, `sdk node ${i} parent`).toBe(conditions[i][0]);
      expect(sdkFlat[i].paramType, `sdk node ${i} type`).toBe(
        conditions[i][1],
      );
      expect(sdkFlat[i].operator, `sdk node ${i} op`).toBe(conditions[i][2]);
      expect(
        (sdkFlat[i].compValue ?? "0x").toLowerCase(),
        `sdk node ${i} compValue`,
      ).toBe(conditions[i][3].toLowerCase());
    }

    // feeCollectors node: same operator and identical compValue bytes,
    // divergent paramType (SDK Array vs ours Tuple — see above).
    expect(sdkFlat[21].operator).toBe(EqualTo);
    expect(conditions[21][2]).toBe(EqualTo);
    expect((sdkFlat[21].compValue ?? "").toLowerCase()).toBe(
      conditions[21][3].toLowerCase(),
    );
    expect(sdkFlat[21].paramType).toBe(ArrayT);
    expect(conditions[21][1]).toBe(Tuple);

    // Array element templates under allowedDepositAddrs / allowedManagers.
    expect(sdkFlat[22]).toMatchObject({ parent: 14, paramType: Static });
    expect(sdkFlat[23]).toMatchObject({ parent: 15, paramType: Static });
    expect(conditions[22]).toEqual([14, Static, Pass, "0x"]);
    expect(conditions[23]).toEqual([15, Static, Pass, "0x"]);
  });
});

describe("generateUpdateSettingsPermissionRolesV2", () => {
  const entries = generateUpdateSettingsPermissionRolesV2(FUND, PINNED);

  it("emits scopeTarget + scopeFunction with exact role key, selector and options", () => {
    expect(entries).toHaveLength(2);

    const scopeTarget = rolesInterface.parseTransaction({ data: entries[0] });
    expect(scopeTarget?.name).toBe("scopeTarget");
    expect(scopeTarget?.args[0]).toBe(ROLE_KEY_BYTES);
    expect(scopeTarget?.args[1].toLowerCase()).toBe(FUND.toLowerCase());

    const scopeFunction = rolesInterface.parseTransaction({
      data: entries[1],
    });
    expect(scopeFunction?.name).toBe("scopeFunction");
    expect(scopeFunction?.args[0]).toBe(ROLE_KEY_BYTES);
    expect(scopeFunction?.args[1].toLowerCase()).toBe(FUND.toLowerCase());
    expect(scopeFunction?.args[2]).toBe(UPDATE_SETTINGS_SELECTOR);
    expect(Number(scopeFunction?.args[4])).toBe(RolesV2ExecutionOptions.None);

    // Conditions round-trip through the real Roles V2 ABI.
    const decodedConditions = scopeFunction?.args[3].map((cond: any) => [
      Number(cond[0]),
      Number(cond[1]),
      Number(cond[2]),
      cond[3],
    ]);
    expect(decodedConditions).toEqual(buildUpdateSettingsConditions(PINNED));
  });

  it("feeCollectors compValue round-trips to the four addresses", () => {
    const conditions = buildUpdateSettingsConditions(PINNED);
    const [decoded] = abiCoder.decode(["address[4]"], conditions[21][3]);
    expect(decoded.map((a: string) => a.toLowerCase())).toEqual(
      PINNED.feeCollectors.map((a) => a.toLowerCase()),
    );
  });

  it("never grants Send/DelegateCall and never touches transferOwnership", () => {
    for (const entry of entries) {
      expect(entry.includes(TRANSFER_OWNERSHIP_SELECTOR.slice(2))).toBe(false);
    }
    const scopeFunction = rolesInterface.parseTransaction({
      data: entries[1],
    });
    expect(Number(scopeFunction?.args[4])).toBe(RolesV2ExecutionOptions.None);
  });
});

describe("generateManageRoleMembersPermissionRolesV2", () => {
  const entries = generateManageRoleMembersPermissionRolesV2(ROLES_MODIFIER);

  it("allows ONLY assignRoles on the modifier, wildcarded, options None", () => {
    expect(entries).toHaveLength(2);

    const scopeTarget = rolesInterface.parseTransaction({ data: entries[0] });
    expect(scopeTarget?.name).toBe("scopeTarget");
    expect(scopeTarget?.args[0]).toBe(ROLE_KEY_BYTES);
    expect(scopeTarget?.args[1].toLowerCase()).toBe(
      ROLES_MODIFIER.toLowerCase(),
    );

    const allowFunction = rolesInterface.parseTransaction({
      data: entries[1],
    });
    expect(allowFunction?.name).toBe("allowFunction");
    expect(allowFunction?.args[0]).toBe(ROLE_KEY_BYTES);
    expect(allowFunction?.args[1].toLowerCase()).toBe(
      ROLES_MODIFIER.toLowerCase(),
    );
    expect(allowFunction?.args[2]).toBe(ASSIGN_ROLES_SELECTOR);
    expect(Number(allowFunction?.args[3])).toBe(RolesV2ExecutionOptions.None);
  });

  it("scopes no other selector — scope*/allow*/revoke*/transferOwnership stay denied", () => {
    // The batch consists of exactly one scopeTarget and one allowFunction,
    // and the only function selector being allowed is assignRoles. Every
    // other selector on the modifier stays unscoped, which Roles V2 denies
    // by default under Clearance.Function.
    const allowedSelectors = entries.map((entry) =>
      rolesInterface.parseTransaction({ data: entry }),
    );
    expect(allowedSelectors.map((tx) => tx?.name).sort()).toEqual([
      "allowFunction",
      "scopeTarget",
    ]);
    const allowFunction = allowedSelectors.find(
      (tx) => tx?.name === "allowFunction",
    );
    expect(allowFunction?.args[2]).toBe(ASSIGN_ROLES_SELECTOR);
    expect(allowFunction?.args[2]).not.toBe(TRANSFER_OWNERSHIP_SELECTOR);
  });
});

describe("parseUpdateSettingsPinnedValues", () => {
  const rawSettings = {
    depositFee: "100",
    withdrawFee: 0n,
    performanceFee: 2000,
    managementFee: "100",
    performaceHurdleRateBps: "0",
    baseToken: PINNED.baseToken,
    safe: PINNED.safe,
    isExternalGovTokenInUse: false,
    isWhitelistedDeposits: "true",
    allowedDepositAddrs: ["0x9999999999999999999999999999999999999999"],
    allowedManagers: [],
    governanceToken: PINNED.governanceToken,
    fundAddress: PINNED.fundAddress,
    governor: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    fundName: "Fixture Fund",
    fundSymbol: "FIX",
    feeCollectors: [...PINNED.feeCollectors],
  };

  it("coerces raw web3 struct values (strings, bigints, bools)", () => {
    const pinned = parseUpdateSettingsPinnedValues(rawSettings, "90", 0n);
    expect(pinned).toEqual(PINNED);
  });

  it("rejects malformed feeCollectors and addresses", () => {
    expect(() =>
      parseUpdateSettingsPinnedValues(
        { ...rawSettings, feeCollectors: rawSettings.feeCollectors.slice(1) },
        "90",
        0n,
      ),
    ).toThrow(/feeCollectors/);
    expect(() =>
      parseUpdateSettingsPinnedValues(
        { ...rawSettings, baseToken: "not-an-address" },
        "90",
        0n,
      ),
    ).toThrow(/baseToken/);
  });
});
