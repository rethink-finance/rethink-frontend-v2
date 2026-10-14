import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  ASSIGN_ROLES_SELECTOR,
  buildPrepopulatedRemovalCalls,
  buildRemovalCalls,
  buildVaultOperationCalls,
  canManageMembers,
  expandRemoval,
  groupByProtocol,
  orderRolesForDisplay,
  removableIndices,
  rolesThatManageMembers,
  splitPrepopulated,
  vaultOperationSwitches,
} from "../composables/permissions/managePermissions";
import type { IStoredRoleView } from "../composables/permissions/storedRoleGrants";

const roles = new ethers.Interface((RolesFullV2 as any).abi);

const EXECUTOR = ethers.encodeBytes32String("defaultManagerRole");
const TOKEN = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
const POOL = "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b";
const OPEN = "0x3333333333333333333333333333333333333333";
const MODIFIER = "0x5Eb928db6224f41B421E050A3689F66B0698AB8E";
const SAFE = "0xb25666BC66630ad02e12E680BAe053b85389D5E9";
const ALICE = "0xE257160f654A2E3222a343FafC4a71AE45Be5d99";
const BOB = "0x2023b43B9cFc2377EBb20886DcA2603D9D7C41B0";

const TRANSFER = "0xa9059cbb";
const APPROVE = "0x095ea7b3";
const SUPPLY = "0x617ba037";

const entry = (name: string, args: unknown[]) => ({
  data: roles.encodeFunctionData(name, args),
  label: name,
});

// Stored grants as the tab replays them: a scoped token with two functions,
// a scoped pool with one, and a contract open to any function.
const ENTRIES = [
  entry("scopeTarget", [EXECUTOR, TOKEN]), // 0
  entry("allowFunction", [EXECUTOR, TOKEN, TRANSFER, 0]), // 1
  entry("allowFunction", [EXECUTOR, TOKEN, APPROVE, 0]), // 2
  entry("scopeTarget", [EXECUTOR, POOL]), // 3
  entry("allowFunction", [EXECUTOR, POOL, SUPPLY, 0]), // 4
  entry("allowTarget", [EXECUTOR, OPEN, 0]), // 5
];

const decode = (calls: string[]) =>
  calls.map((data) => {
    const parsed = roles.parseTransaction({ data })!;
    return [parsed.name, ...parsed.args.slice(1).map((arg: any) => String(arg).toLowerCase())];
  });

describe("manage mode removals", () => {
  it("offers every grant for removal", () => {
    expect(removableIndices(ENTRIES)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("removing a contract removes everything on it", () => {
    expect(expandRemoval(ENTRIES, [0])).toEqual([0, 1, 2]);
  });

  it("removing a contract's last function clears the contract too", () => {
    expect(expandRemoval(ENTRIES, [4])).toEqual([3, 4]);
    expect(expandRemoval(ENTRIES, [1])).toEqual([1]);
  });

  it("revokes one function and keeps the contract another function still uses", () => {
    expect(decode(buildRemovalCalls(ENTRIES, [1], EXECUTOR))).toEqual([
      ["revokeFunction", TOKEN.toLowerCase(), TRANSFER],
    ]);
  });

  it("clears a contract once nothing on it survives", () => {
    expect(decode(buildRemovalCalls(ENTRIES, expandRemoval(ENTRIES, [3]), EXECUTOR))).toEqual([
      ["revokeFunction", POOL.toLowerCase(), SUPPLY],
      ["revokeTarget", POOL.toLowerCase()],
    ]);
  });

  it("clears an open contract with revokeTarget alone", () => {
    expect(decode(buildRemovalCalls(ENTRIES, [5], EXECUTOR))).toEqual([
      ["revokeTarget", OPEN.toLowerCase()],
    ]);
  });

  it("writes the calls for the role they came from", () => {
    const [call] = buildRemovalCalls(ENTRIES, [1], EXECUTOR);
    expect(roles.parseTransaction({ data: call })!.args[0]).toBe(EXECUTOR);
  });

  it("sends nothing when nothing is removed", () => {
    expect(buildRemovalCalls(ENTRIES, [], EXECUTOR)).toEqual([]);
  });
});

const view = (patch: Partial<IStoredRoleView>): IStoredRoleView => ({
  keyBytes: EXECUTOR.toLowerCase(),
  label: "defaultManagerRole",
  kind: "executor",
  number: 2,
  name: "Executor",
  members: [],
  disabledMembers: [],
  entries: [],
  contracts: 0,
  openContracts: 0,
  emptyTargets: [],
  functions: 0,
  allowances: [],
  ...patch,
});

describe("who may change members", () => {
  const admin = view({
    kind: "admin",
    number: 1,
    name: "Admin",
    members: [ALICE],
    entries: [
      entry("scopeTarget", [EXECUTOR, MODIFIER]),
      entry("allowFunction", [EXECUTOR, MODIFIER, ASSIGN_ROLES_SELECTOR, 0]),
    ],
  });
  const executor = view({ members: [BOB], entries: ENTRIES });

  it("finds the roles allowed to call assignRoles on the modifier", () => {
    expect(rolesThatManageMembers([executor, admin], MODIFIER)).toEqual([admin]);
  });

  it("lets a holder of such a role, or the vault Safe, change members", () => {
    const managers = rolesThatManageMembers([executor, admin], MODIFIER);
    expect(canManageMembers(ALICE.toLowerCase(), { safeAddress: SAFE, managers })).toBe(true);
    expect(canManageMembers(SAFE.toLowerCase(), { safeAddress: SAFE, managers })).toBe(true);
    expect(canManageMembers(BOB, { safeAddress: SAFE, managers })).toBe(false);
    expect(canManageMembers(undefined, { safeAddress: SAFE, managers })).toBe(false);
  });

  it("does not count a member whose module is disabled", () => {
    const managers = [{ ...admin, disabledMembers: [ALICE] }];
    expect(canManageMembers(ALICE, { safeAddress: SAFE, managers })).toBe(false);
  });

  it("lists roles by number: admin, executor, then custom roles", () => {
    const custom = view({ kind: "custom", number: 3, name: "Trader" });
    expect(orderRolesForDisplay([custom, executor, admin]).map((role) => role.name)).toEqual([
      "Admin",
      "Executor",
      "Trader",
    ]);
  });
});

describe("prepopulated permissions", () => {
  const ADMIN_KEY = "adminRole";
  const EXECUTOR_KEY = "defaultManagerRole";
  const FUND = "0x4444444444444444444444444444444444444444";
  const BASE = "0x1111111111111111111111111111111111111111";
  const contracts = { fundAddress: FUND, baseToken: BASE, rolesModifier: MODIFIER };
  const PINNED_SETTINGS = {
    depositFee: 100n,
    withdrawFee: 0n,
    performanceFee: 2000n,
    managementFee: 100n,
    performaceHurdleRateBps: 0n,
    baseToken: BASE,
    safe: SAFE,
    isExternalGovTokenInUse: false,
    isWhitelistedDeposits: true,
    governanceToken: FUND,
    fundAddress: FUND,
    fundName: "Fixture Fund",
    fundSymbol: "FIX",
    feeCollectors: [SAFE, SAFE, SAFE, SAFE],
    feePerformancePeriod: 90n,
    feeManagePeriod: 0n,
  };
  const asEntries = (calls: string[]) => calls.map((data) => ({ data, label: "call" }));
  const NAV_EXECUTOR = "0x49a2Ec2De6CbdB3282c5BdEc3b6ceb0157d84A47";
  const PROTOCOL = "0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b";

  it("splits the executor's switch grants from its other permissions", async () => {
    const { generateNAVPermissionRolesV2 } = await import("../composables/nav/generateNAVPermission");
    const entries = asEntries([
      ...generateNAVPermissionRolesV2(FUND, NAV_EXECUTOR, EXECUTOR_KEY),
      roles.encodeFunctionData("scopeTarget", [ethers.encodeBytes32String(EXECUTOR_KEY), PROTOCOL]),
      roles.encodeFunctionData("allowFunction", [ethers.encodeBytes32String(EXECUTOR_KEY), PROTOCOL, SUPPLY, 0]),
    ]);
    const split = splitPrepopulated(entries, EXECUTOR_KEY, contracts, EXECUTOR_KEY);
    expect(split.grants.map((grant) => [grant.label, grant.granted])).toEqual([
      ["Send funds to admin contract & settle flows", false],
      ["Collect fee", false],
      ["Update NAV", true],
      ["Self-revoke role", false],
    ]);
    expect(split.grants.find((grant) => grant.label === "Update NAV")?.hint).toContain("NAV");
    // The vault contract's opening call goes with NAV; the protocol stays "other".
    expect(split.prepopulated.length + split.other.length).toBe(entries.length);
    expect(split.other.map((entry) => roles.parseTransaction({ data: entry.data })!.args[1])).toEqual([
      PROTOCOL,
      PROTOCOL,
    ]);
  });

  it("reads which admin switches a stored settings grant opens", async () => {
    const { generateUpdateSettingsPermissionRolesV2 } = await import(
      "../composables/permissions/rolesV2Permissions"
    );
    const entries = asEntries(
      generateUpdateSettingsPermissionRolesV2(FUND, PINNED_SETTINGS as any, ADMIN_KEY, {
        metadata: true,
        whitelist: false,
        feeDestinations: true,
      }),
    );
    const settings = splitPrepopulated(entries, ADMIN_KEY, contracts, EXECUTOR_KEY).grants.find(
      (grant) => grant.label === "Vault settings",
    )!;
    expect(settings.granted).toBe(true);
    expect(settings.switches).toEqual([
      { label: "Update vault metadata", on: true },
      { label: "Manage whitelist", on: false },
      { label: "Change fee destination addresses", on: true },
    ]);
  });

  it("reads which roles a stored membership grant may change", async () => {
    const { generateAssignRolesPermissionRolesV2 } = await import(
      "../composables/permissions/rolesV2Permissions"
    );
    const entries = asEntries(
      generateAssignRolesPermissionRolesV2(MODIFIER, ADMIN_KEY, { roleKeys: [EXECUTOR_KEY] }),
    );
    const split = splitPrepopulated(entries, ADMIN_KEY, contracts, EXECUTOR_KEY);
    expect(split.grants.find((grant) => grant.label === "Role management")?.switches).toEqual([
      { label: "Manage executor role members", on: true },
      { label: "Transfer admin role", on: false },
    ]);
    expect(split.grants.find((grant) => grant.label === "Vault settings")?.granted).toBe(false);
    expect(split.other).toEqual([]);
  });

  it("gives a custom role no prepopulated grants", () => {
    const split = splitPrepopulated(ENTRIES, "trader", contracts, EXECUTOR_KEY);
    expect(split.grants).toEqual([]);
    expect(split.other).toBe(ENTRIES);
  });

  it("revokes prepopulated grants by function only", () => {
    const calls = buildPrepopulatedRemovalCalls(
      [{ target: FUND, selector: "0xa61f5814" }],
      ethers.encodeBytes32String(EXECUTOR_KEY),
    );
    expect(decode(calls)).toEqual([["revokeFunction", FUND.toLowerCase(), "0xa61f5814"]]);
  });
});

describe("vault operations as switches", () => {
  const ADMIN_KEY = "adminRole";
  const EXECUTOR_KEY = "defaultManagerRole";
  const FUND = "0x4444444444444444444444444444444444444444";
  const BASE = "0x1111111111111111111111111111111111111111";
  const NAV_EXECUTOR = "0x49a2Ec2De6CbdB3282c5BdEc3b6ceb0157d84A47";
  const FEE = "0x9999999999999999999999999999999999999999";
  const RAW_SETTINGS = {
    depositFee: "0",
    withdrawFee: "0",
    performanceFee: "2000",
    managementFee: "0",
    performaceHurdleRateBps: "0",
    baseToken: BASE,
    safe: SAFE,
    isExternalGovTokenInUse: false,
    isWhitelistedDeposits: false,
    allowedDepositAddrs: [],
    allowedManagers: [],
    governanceToken: FUND,
    fundAddress: FUND,
    governor: SAFE,
    fundName: "Fixture Fund",
    fundSymbol: "FIX",
    feeCollectors: [SAFE, SAFE, SAFE, SAFE],
  };
  const context = {
    fundAddress: FUND,
    baseToken: BASE,
    rolesModifier: MODIFIER,
    navExecutor: NAV_EXECUTOR,
    poolPerformanceFee: FEE,
    executorRoleKey: EXECUTOR_KEY,
    rawSettings: RAW_SETTINGS,
    fundMetadata: "{}",
    feePerformancePeriod: "0",
    feeManagePeriod: "0",
  };
  const ALL_EXECUTOR = { sendFunds: true, collectFees: true, updateNav: true, selfRevoke: true };
  const ALL_ADMIN = {
    manageExecutorMembers: true,
    transferAdminRole: true,
    manageWhitelist: true,
    updateMetadata: true,
    changeFeeDestinations: true,
  };

  it("sends nothing for switches left as they are", () => {
    expect(buildVaultOperationCalls(EXECUTOR_KEY, ALL_EXECUTOR, ALL_EXECUTOR, context)).toEqual([]);
    expect(buildVaultOperationCalls(ADMIN_KEY, ALL_ADMIN, ALL_ADMIN, context)).toEqual([]);
  });

  it("turns an executor operation off with one revokeFunction", () => {
    const calls = buildVaultOperationCalls(EXECUTOR_KEY, ALL_EXECUTOR, { ...ALL_EXECUTOR, updateNav: false }, context);
    expect(decode(calls)).toEqual([["revokeFunction", FUND.toLowerCase(), "0xa61f5814"]]);
  });

  it("turns an executor operation on with the create flow's own grant", async () => {
    const { generateNAVPermissionRolesV2 } = await import("../composables/nav/generateNAVPermission");
    const calls = buildVaultOperationCalls(EXECUTOR_KEY, { ...ALL_EXECUTOR, updateNav: false }, ALL_EXECUTOR, context);
    expect(calls).toEqual(generateNAVPermissionRolesV2(FUND, NAV_EXECUTOR, EXECUTOR_KEY));
  });

  it("re-issues the admin's settings grant from the switches left on", async () => {
    const { generateUpdateSettingsPermissionRolesV2, parseUpdateSettingsPinnedValues } = await import(
      "../composables/permissions/rolesV2Permissions"
    );
    const calls = buildVaultOperationCalls(ADMIN_KEY, ALL_ADMIN, { ...ALL_ADMIN, manageWhitelist: false }, context);
    expect(calls).toEqual(
      generateUpdateSettingsPermissionRolesV2(
        FUND,
        parseUpdateSettingsPinnedValues(RAW_SETTINGS, "0", "0", "{}"),
        ADMIN_KEY,
        { metadata: true, whitelist: false, feeDestinations: true },
      ),
    );
  });

  it("revokes the admin's settings grant when every settings switch is off", () => {
    const calls = buildVaultOperationCalls(
      ADMIN_KEY,
      ALL_ADMIN,
      { ...ALL_ADMIN, manageWhitelist: false, updateMetadata: false, changeFeeDestinations: false },
      context,
    );
    expect(decode(calls)).toEqual([["revokeFunction", FUND.toLowerCase(), "0xf6c87ad5"]]);
  });

  it("narrows the admin's membership grant to the roles left on", async () => {
    const { generateAssignRolesPermissionRolesV2 } = await import("../composables/permissions/rolesV2Permissions");
    const calls = buildVaultOperationCalls(ADMIN_KEY, ALL_ADMIN, { ...ALL_ADMIN, transferAdminRole: false }, context);
    expect(calls).toEqual(generateAssignRolesPermissionRolesV2(MODIFIER, ADMIN_KEY, { roleKeys: [EXECUTOR_KEY] }));
  });

  it("reads the switches back from stored grants", async () => {
    const { generateAssignRolesPermissionRolesV2 } = await import("../composables/permissions/rolesV2Permissions");
    const entries = generateAssignRolesPermissionRolesV2(MODIFIER, ADMIN_KEY, { roleKeys: [EXECUTOR_KEY] }).map(
      (data) => ({ data, label: "call" }),
    );
    const { grants } = splitPrepopulated(entries, ADMIN_KEY, { fundAddress: FUND, baseToken: BASE, rolesModifier: MODIFIER }, EXECUTOR_KEY);
    expect(vaultOperationSwitches(grants, ADMIN_KEY).map((op) => [op.key, op.on])).toEqual([
      ["manageExecutorMembers", true],
      ["transferAdminRole", false],
      ["manageWhitelist", false],
      ["updateMetadata", false],
      ["changeFeeDestinations", false],
    ]);
    expect(vaultOperationSwitches(grants, ADMIN_KEY)[0].hint).toContain("executor role");
  });
});

describe("protocol access grouped by protocol", () => {
  const CDW = "0x6B9E773128f453f5c2C60935Ee2DE2CBc5390A24";
  const FELIX = "0x8A862fD6c12f9ad34C9c2ff45AB2b6712e8CEa27";
  const CORE = "0x3333333333333333333333333333333333333333";
  const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
  const KEY = ethers.encodeBytes32String("defaultManagerRole");
  const ENTRY = (name: string, args: unknown[]) => ({ data: roles.encodeFunctionData(name, args), label: name });
  const entries = [
    ENTRY("scopeTarget", [KEY, USDC]),
    ENTRY("allowFunction", [KEY, USDC, "0x095ea7b3", 0]),
    ENTRY("scopeTarget", [KEY, CDW]),
    ENTRY("allowFunction", [KEY, CDW, "0xc23c545a", 0]),
    ENTRY("scopeTarget", [KEY, CORE]),
    ENTRY("allowFunction", [KEY, CORE, ethers.id("sendRawAction(bytes)").slice(0, 10), 0]),
    ENTRY("scopeTarget", [KEY, FELIX]),
    ENTRY("allowFunction", [KEY, FELIX, "0x6e553f65", 0]),
    ENTRY("allowFunction", [KEY, FELIX, "0xb460af94", 0]),
    ENTRY("allowFunction", [KEY, FELIX, "0xba087652", 0]),
    ENTRY("allowTarget", [KEY, "0x7777777777777777777777777777777777777777", 0]),
  ];

  it("groups contracts under their protocol, with tags for what is allowed", async () => {
    const { contractProtocol } = await import("../composables/contracts/contractNames");
    const groups = groupByProtocol(entries, contractProtocol, () => "Some contract");
    expect(groups.map((group) => [group.name, group.targets.length, group.tags])).toEqual([
      ["USDC", 1, ["Approve"]],
      ["HyperCore", 2, ["Deposit", "Any action"]],
      ["Felix", 1, ["Supply", "Withdraw"]],
      ["Some contract", 1, ["Any function"]],
    ]);
    expect(groups[1].indices).toEqual([2, 3, 4, 5]);
    expect(groups[1].logo).toEqual({ protocol: "hyperliquid" });
    expect(groups[0].logo).toEqual({ token: "USDC" });
  });

  it("names sciETH's staking, Lido, CoW and payout grants by what they do", async () => {
    const { contractProtocol } = await import("../composables/contracts/contractNames");
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
    const HUB = "0xA2A9C501D1D29fF696E7045c05DeEf1ed7511143";
    const STAKING_VAULT = "0x51CDD86C08319283aFc8d9a797efaa0458DB6343";
    const COW_SIGNER = "0x23dA9AdE38E4477b23770DeD512fD37b12381FAB";
    const MULTISIG = "0xf0b31Db69b57023b2050eCa2A32932Dd0CEac9E9";
    const STRANGER = "0x7777777777777777777777777777777777777777";
    const SEND = "0x00000000";
    const allow = (target: string, selector: string) =>
      entry("allowFunction", [EXECUTOR, target, selector, 0]);
    const entries = [
      allow(WETH, "0xd0e30db0"), // deposit()
      allow(WETH, "0x2e1a7d4d"), // withdraw(uint256)
      allow(HUB, "0x9abbdf4b"), // createVault
      allow(STAKING_VAULT, "0x1c1408f0"), // requestStakeQuota
      allow(STAKING_VAULT, SEND),
      allow(STAKING_VAULT, "0xe1f06f54"), // withdrawPrincipal
      allow(STAKING_VAULT, "0x372500ab"), // claimRewards
      allow(STETH, "0xa1903eab"), // submit
      allow(STETH, APPROVE),
      allow(COW_SIGNER, "0x569d3489"), // signOrder
      allow(COW_SIGNER, "0x5a66c223"), // unsignOrder
      allow(MULTISIG, SEND),
      allow(STRANGER, SEND),
    ];
    const groups = groupByProtocol(entries, contractProtocol, () => "Some address");
    expect(groups.map((group) => [group.name, group.targets.length, group.tags])).toEqual([
      ["WETH", 1, ["Wrap", "Unwrap"]],
      ["w3.labs staking", 2, ["Create vault", "Request quota", "Stake", "Withdraw principal", "Claim rewards"]],
      ["Lido", 1, ["Stake ETH", "Approve"]],
      ["CoW Swap", 1, ["Place order", "Cancel order"]],
      ["Yield multisig", 1, ["Send yield"]],
      ["Some address", 1, ["Send ETH"]],
    ]);
    expect(groups.find((group) => group.tags.includes("Other"))).toBeUndefined();
    // A bare recipient reads as a wallet, not a contract.
    expect(groups[5].logo).toEqual({ icon: "material-symbols:account-balance-wallet-outline-rounded" });
  });
});
