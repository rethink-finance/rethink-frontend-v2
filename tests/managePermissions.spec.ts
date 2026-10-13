import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  ASSIGN_ROLES_SELECTOR,
  buildPrepopulatedRemovalCalls,
  buildRemovalCalls,
  canManageMembers,
  expandRemoval,
  orderRolesForDisplay,
  removableIndices,
  rolesThatManageMembers,
  splitPrepopulated,
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
