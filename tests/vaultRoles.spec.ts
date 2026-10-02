import { ethers } from "ethers";
import { describe, expect, it } from "vitest";
import RolesFullV2 from "../assets/contracts/zodiac/RolesFullV2.json";
import {
  ASSIGN_ROLES_SELECTOR,
  EXECUTE_NAV_UPDATE_SELECTOR,
  FUND_FLOWS_CALL_SELECTOR,
  TRANSFER_SELECTOR,
  UPDATE_SETTINGS_SELECTOR,
} from "../composables/permissions/rolesV2Permissions";
import {
  VAULT_ROLES,
  buildPrepopulatedPermissionsBatch,
  customRoleNameError,
  defaultVaultRolePermissions,
  fullVaultRolePermissions,
  prepopulatedScopeLabels,
  resolveCustomRoles,
  type IPrepopulatedPermissionsContext,
  type IVaultRolePermissions,
} from "../composables/permissions/vaultRoles";

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

const FUND = "0x111f164d91e3f8169a7043f7094f44af87fb7ca4";
const BASE_TOKEN = "0x1111111111111111111111111111111111111111";
const MODIFIER = "0x583a40de5b558cc04ee50795f9425bfc141c9107";
const NAV_EXECUTOR = "0x000000000000000000000000000000000000aa01";
const PERF_FEE = "0x000000000000000000000000000000000000fee1";
const ADMIN_KEY = ethers.encodeBytes32String("adminRole");
const EXECUTOR_KEY = ethers.encodeBytes32String("defaulManagerRole");

const CONTEXT: IPrepopulatedPermissionsContext = {
  fundAddress: FUND,
  baseToken: BASE_TOKEN,
  rolesModifier: MODIFIER,
  navExecutor: NAV_EXECUTOR,
  poolPerformanceFee: PERF_FEE,
  rawSettings: {
    depositFee: "100",
    withdrawFee: "0",
    performanceFee: "2000",
    managementFee: "100",
    performaceHurdleRateBps: "0",
    baseToken: BASE_TOKEN,
    safe: "0x2222222222222222222222222222222222222222",
    isExternalGovTokenInUse: false,
    isWhitelistedDeposits: true,
    allowedDepositAddrs: [],
    allowedManagers: [],
    governanceToken: "0x3333333333333333333333333333333333333333",
    fundAddress: FUND,
    governor: "0x4444444444444444444444444444444444444444",
    fundName: "Fixture Fund",
    fundSymbol: "FIX",
    feeCollectors: [
      "0x5555555555555555555555555555555555555555",
      "0x6666666666666666666666666666666666666666",
      "0x7777777777777777777777777777777777777777",
      "0x8888888888888888888888888888888888888888",
    ],
  },
  fundMetadata: "{}",
  feePerformancePeriod: "90",
  feeManagePeriod: "0",
};

interface ICall {
  name: string;
  role: string;
  target: string;
  selector?: string;
}

const decode = (entries: string[]): ICall[] =>
  entries.map((data) => {
    const tx = rolesInterface.parseTransaction({ data })!;
    return {
      name: tx.name,
      role: tx.args[0],
      target: String(tx.args[1]).toLowerCase(),
      selector: tx.args.length > 2 ? String(tx.args[2]) : undefined,
    };
  });

const functionsOf = (calls: ICall[], role: string, name = "scopeFunction") =>
  calls
    .filter((call) => call.role === role && call.name === name)
    .map((call) => `${call.target}:${call.selector}`)
    .sort();

const key = (target: string, selector: string) =>
  `${target.toLowerCase()}:${selector}`;

const withPermissions = (
  change: (permissions: IVaultRolePermissions) => void,
) => {
  const permissions = fullVaultRolePermissions();
  change(permissions);
  return permissions;
};

describe("VAULT_ROLES", () => {
  it("numbers the admin 1 and the executor 2, on distinct role keys", () => {
    expect(VAULT_ROLES.admin.number).toBe(1);
    expect(VAULT_ROLES.executor.number).toBe(2);
    expect(VAULT_ROLES.admin.roleKey).toBe("adminRole");
    // The factory assigns the creating wallet to this exact key.
    expect(VAULT_ROLES.executor.roleKey).toBe("defaulManagerRole");
  });

  it("opens with role management on and vault settings off", () => {
    const defaults = defaultVaultRolePermissions();
    expect(defaults.adminEnabled).toBe(true);
    expect(defaults.admin).toEqual({
      manageExecutorMembers: true,
      transferAdminRole: true,
      manageWhitelist: false,
      updateMetadata: false,
      changeFeeDestinations: false,
    });
    expect(Object.values(defaults.executor).every(Boolean)).toBe(true);
  });

  it("starts whitelist management on only for a vault created with a whitelist", () => {
    expect(defaultVaultRolePermissions({ whitelistInUse: true }).admin.manageWhitelist).toBe(true);
    expect(defaultVaultRolePermissions({ whitelistInUse: true }).admin.updateMetadata).toBe(false);
    expect(defaultVaultRolePermissions({ whitelistInUse: false }).admin.manageWhitelist).toBe(false);
  });

  it("groups the admin's permissions into role management and vault settings", () => {
    const [roleManagement, vaultSettings] = VAULT_ROLES.admin.groups;
    expect(roleManagement.defaultOn).toBe(true);
    expect(roleManagement.permissions.map((option) => option.key)).toEqual([
      "manageExecutorMembers",
      "transferAdminRole",
    ]);
    expect(vaultSettings.defaultOn).toBe(false);
    expect(vaultSettings.permissions.map((option) => option.key)).toEqual([
      "manageWhitelist",
      "updateMetadata",
      "changeFeeDestinations",
    ]);
    // The reason they are off is said where they are switched on.
    expect(vaultSettings.note).toMatch(/governance proposal/);
    // Each group's starting state is what the defaults actually are.
    const defaults = defaultVaultRolePermissions();
    for (const role of [VAULT_ROLES.admin, VAULT_ROLES.executor]) {
      for (const group of role.groups) {
        for (const option of group.permissions) {
          expect((defaults[role.id] as any)[option.key], option.key).toBe(group.defaultOn);
        }
      }
    }
  });

  it("grants nothing on the vault's settings by default", () => {
    const { grants, revokes } = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      defaultVaultRolePermissions(),
    );
    expect(functionsOf(decode(grants), ADMIN_KEY)).toEqual([
      key(MODIFIER, ASSIGN_ROLES_SELECTOR),
    ]);
    expect(functionsOf(decode(revokes), ADMIN_KEY, "revokeFunction")).toEqual([
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    ]);
  });

  it("offers a switch for every permission the defaults know, and no other", () => {
    const defaults = fullVaultRolePermissions();
    for (const role of [VAULT_ROLES.admin, VAULT_ROLES.executor]) {
      expect(role.permissions.map((option) => option.key).sort()).toEqual(
        Object.keys(defaults[role.id]).sort(),
      );
    }
  });
});

describe("buildPrepopulatedPermissionsBatch", () => {
  it("splits the default grants between the two roles", () => {
    const { grants } = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      fullVaultRolePermissions(),
    );
    const calls = decode(grants);

    expect(functionsOf(calls, EXECUTOR_KEY)).toEqual(
      [
        key(BASE_TOKEN, TRANSFER_SELECTOR),
        key(FUND, EXECUTE_NAV_UPDATE_SELECTOR),
        key(FUND, FUND_FLOWS_CALL_SELECTOR),
        key(MODIFIER, ASSIGN_ROLES_SELECTOR),
      ].sort(),
    );
    expect(functionsOf(calls, ADMIN_KEY)).toEqual(
      [
        key(FUND, UPDATE_SETTINGS_SELECTOR),
        key(MODIFIER, ASSIGN_ROLES_SELECTOR),
      ].sort(),
    );
    // Nothing is ever wildcarded, and only the two roles are written to.
    expect(calls.some((call) => call.name.startsWith("allow"))).toBe(false);
    expect(new Set(calls.map((call) => call.role))).toEqual(
      new Set([ADMIN_KEY, EXECUTOR_KEY]),
    );
  });

  it("never grants the executor vault settings — and always takes them back", () => {
    const { revokes, grants } = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      fullVaultRolePermissions(),
    );
    expect(functionsOf(decode(grants), EXECUTOR_KEY)).not.toContain(
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    );
    // A vault that saved before the admin role existed has it stored.
    expect(functionsOf(decode(revokes), EXECUTOR_KEY, "revokeFunction")).toEqual([
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    ]);
  });

  it("revokes an executor switch that is off instead of leaving it out", () => {
    const { revokes, grants } = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      withPermissions((p) => {
        p.executor.sendFunds = false;
        p.executor.selfRevoke = false;
      }),
    );
    const revoked = decode(revokes);
    expect(functionsOf(revoked, EXECUTOR_KEY, "revokeFunction")).toEqual(
      [
        key(BASE_TOKEN, TRANSFER_SELECTOR),
        key(MODIFIER, ASSIGN_ROLES_SELECTOR),
        key(FUND, UPDATE_SETTINGS_SELECTOR),
      ].sort(),
    );
    expect(functionsOf(decode(grants), EXECUTOR_KEY)).toEqual(
      [
        key(FUND, EXECUTE_NAV_UPDATE_SELECTOR),
        key(FUND, FUND_FLOWS_CALL_SELECTOR),
      ].sort(),
    );
  });

  it("never clears a target, whatever is switched off", () => {
    // The base token, the vault and the modifier are shared with what the
    // Integrations step grants; a target revoke here would switch those
    // grants off too.
    for (const adminEnabled of [true, false]) {
      const { revokes, grants } = buildPrepopulatedPermissionsBatch(
        CONTEXT,
        withPermissions((p) => {
          p.adminEnabled = adminEnabled;
          for (const k of Object.keys(p.admin)) (p.admin as any)[k] = false;
          for (const k of Object.keys(p.executor)) (p.executor as any)[k] = false;
        }),
      );
      expect(grants).toEqual([]);
      const revoked = decode(revokes);
      expect(revoked.length).toBeGreaterThan(0);
      expect(revoked.every((call) => call.name === "revokeFunction")).toBe(true);
    }
  });

  it("revokes the admin's settings permission only when all three parts are off", () => {
    const one = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      withPermissions((p) => {
        p.admin.updateMetadata = false;
        p.admin.manageWhitelist = false;
      }),
    );
    expect(functionsOf(decode(one.grants), ADMIN_KEY)).toContain(
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    );
    expect(functionsOf(decode(one.revokes), ADMIN_KEY, "revokeFunction")).toEqual([]);

    const none = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      withPermissions((p) => {
        p.admin.updateMetadata = false;
        p.admin.manageWhitelist = false;
        p.admin.changeFeeDestinations = false;
      }),
    );
    expect(functionsOf(decode(none.grants), ADMIN_KEY)).not.toContain(
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    );
    expect(functionsOf(decode(none.revokes), ADMIN_KEY, "revokeFunction")).toEqual([
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    ]);
  });

  it("revokes the admin's membership permission when both parts are off", () => {
    const { revokes, grants } = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      withPermissions((p) => {
        p.admin.manageExecutorMembers = false;
        p.admin.transferAdminRole = false;
      }),
    );
    expect(functionsOf(decode(grants), ADMIN_KEY)).toEqual([
      key(FUND, UPDATE_SETTINGS_SELECTOR),
    ]);
    expect(functionsOf(decode(revokes), ADMIN_KEY, "revokeFunction")).toEqual([
      key(MODIFIER, ASSIGN_ROLES_SELECTOR),
    ]);
  });

  it("grants a disabled admin role nothing, and takes back what it had", () => {
    const { revokes, grants } = buildPrepopulatedPermissionsBatch(
      CONTEXT,
      withPermissions((p) => {
        p.adminEnabled = false;
      }),
    );
    // Its switches are all still on; the role being off is what counts.
    expect(decode(grants).some((call) => call.role === ADMIN_KEY)).toBe(false);
    expect(functionsOf(decode(revokes), ADMIN_KEY, "revokeFunction")).toEqual(
      [
        key(FUND, UPDATE_SETTINGS_SELECTOR),
        key(MODIFIER, ASSIGN_ROLES_SELECTOR),
      ].sort(),
    );
    // The executor is untouched by it.
    expect(functionsOf(decode(grants), EXECUTOR_KEY)).toHaveLength(4);
  });

  it("says which address is missing instead of encoding a broken grant", () => {
    expect(() =>
      buildPrepopulatedPermissionsBatch(
        { ...CONTEXT, navExecutor: undefined },
        fullVaultRolePermissions(),
      ),
    ).toThrow(/NAV executor/);
    expect(() =>
      buildPrepopulatedPermissionsBatch(
        { ...CONTEXT, poolPerformanceFee: undefined },
        fullVaultRolePermissions(),
      ),
    ).toThrow(/performance fee/);
  });
});

describe("custom roles", () => {
  const TRADER_KEY = ethers.encodeBytes32String("Trader");

  it("accepts a name that fits a role key, and nothing else", () => {
    expect(customRoleNameError("Trader", [])).toBe("");
    expect(customRoleNameError("  ops_team-2  ", [])).toBe("");
    expect(customRoleNameError("", [])).not.toBe("");
    expect(customRoleNameError("two words", [])).not.toBe("");
    expect(customRoleNameError("a".repeat(32), [])).not.toBe("");
    expect(customRoleNameError("ünïcode", [])).not.toBe("");
  });

  it("refuses the built-in roles and a name already taken, whatever the case", () => {
    for (const name of ["adminRole", "defaulManagerRole", "Admin", "executor"]) {
      expect(customRoleNameError(name, [])).not.toBe("");
    }
    expect(customRoleNameError("trader", ["Trader"])).not.toBe("");
  });

  it("numbers the roles from 3: the ones on the modifier, then the ones only named", () => {
    const roles = resolveCustomRoles(
      [EXECUTOR_KEY, TRADER_KEY, ADMIN_KEY],
      ["Bridger", "Trader"],
    );
    expect(roles).toEqual([
      {
        roleKey: "Trader",
        keyBytes: TRADER_KEY.toLowerCase(),
        name: "Trader",
        number: 3,
        stored: true,
      },
      {
        roleKey: "Bridger",
        keyBytes: ethers.encodeBytes32String("Bridger").toLowerCase(),
        name: "Bridger",
        number: 4,
        stored: false,
      },
    ]);
  });

  it("keeps a key that is not a readable name as its hex", () => {
    const key = "0x" + "ab".repeat(32);
    const [role] = resolveCustomRoles([key], []);
    expect(role.roleKey).toBe(key);
    expect(role.keyBytes).toBe(key);
    expect(role.stored).toBe(true);
  });

  it("names the Roles step's grants per role, and none for a custom role", () => {
    const executor = prepopulatedScopeLabels("defaulManagerRole", CONTEXT);
    expect(executor.map(({ label }) => label)).toEqual(
      VAULT_ROLES.executor.permissions.map((option) => option.label),
    );
    expect(executor.map(({ scope }) => scope)).toContainEqual({
      target: BASE_TOKEN,
      selector: TRANSFER_SELECTOR,
    });
    expect(prepopulatedScopeLabels("adminRole", CONTEXT).map(({ scope }) => scope)).toEqual([
      { target: MODIFIER, selector: ASSIGN_ROLES_SELECTOR },
      { target: FUND, selector: UPDATE_SETTINGS_SELECTOR },
    ]);
    expect(prepopulatedScopeLabels("Trader", CONTEXT)).toEqual([]);
  });
});
