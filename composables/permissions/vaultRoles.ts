import { ethers } from "ethers";
import {
  ADMIN_ROLE_KEY_V2,
  EXECUTOR_ROLE_KEY_ALIASES_V2,
  EXECUTOR_ROLE_KEY_V2,
  generateNAVPermissionRolesV2,
  isExecutorRoleKey,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";
import {
  buildRevokeFunctionEntriesV2,
  type IPermissionScope,
} from "~/composables/permissions/revokePermissions";
import {
  ASSIGN_ROLES_SELECTOR,
  EXECUTE_NAV_UPDATE_SELECTOR,
  FUND_FLOWS_CALL_SELECTOR,
  TRANSFER_SELECTOR,
  UPDATE_SETTINGS_SELECTOR,
  generateAssignRolesPermissionRolesV2,
  generateCollectFeesPermissionRolesV2,
  generateSendFundsPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";

/**
 * The two roles a Roles V2 vault starts with, and the prepopulated
 * permissions each one carries.
 *
 * - Role 1, the ADMIN, runs the vault around the strategy: its profile, who
 *   may deposit, who curates, where fees are paid.
 * - Role 2, the EXECUTOR, runs the strategy: NAV, flows, fee collection and
 *   every protocol or raw permission the create flow's Permissions step
 *   grants.
 *
 * The split is the point: the executor cannot widen its own team or touch
 * the vault's settings, and the admin holds no power over the vault's
 * funds — beyond deciding who the executors are.
 */

export type VaultRoleId = "admin" | "executor";

export interface IAdminPermissions {
  updateMetadata: boolean;
  manageWhitelist: boolean;
  manageExecutorMembers: boolean;
  transferAdminRole: boolean;
  changeFeeDestinations: boolean;
}

export interface IExecutorPermissions {
  sendFunds: boolean;
  collectFees: boolean;
  updateNav: boolean;
  selfRevoke: boolean;
}

export interface IVaultRolePermissions {
  /**
   * Whether the vault has an admin role at all. Off, nothing is granted to
   * it whatever its switches say (they are kept, so turning the role back on
   * restores them) and everything it would do stays with governance.
   */
  adminEnabled: boolean;
  admin: IAdminPermissions;
  executor: IExecutorPermissions;
}

/** Every switch on: the widest set the step can grant. */
export const fullVaultRolePermissions = (): IVaultRolePermissions => ({
  adminEnabled: true,
  admin: {
    updateMetadata: true,
    manageWhitelist: true,
    manageExecutorMembers: true,
    transferAdminRole: true,
    changeFeeDestinations: true,
  },
  executor: {
    sendFunds: true,
    collectFees: true,
    updateNav: true,
    selfRevoke: true,
  },
});

/**
 * What the step opens with: every switch on. They are what a vault normally
 * needs to run, and whoever does not want one turns it off rather than
 * discovering later that nobody can settle a flow or maintain the whitelist.
 */
export const defaultVaultRolePermissions = (): IVaultRolePermissions =>
  fullVaultRolePermissions();

export interface IRolePermissionOption {
  key: string;
  label: string;
  /** One sentence on what switching it on allows, for the row's info mark. */
  hint: string;
}

export interface IRolePermissionGroup {
  id: string;
  title: string;
  /**
   * The state the group opens in: on for what a vault needs to run, off for
   * what has to be decided. The card folds a group that is in this state.
   */
  defaultOn: boolean;
  /** Something to read before switching anything in the group on. */
  note?: string;
  permissions: IRolePermissionOption[];
}

export interface IVaultRoleDefinition {
  id: VaultRoleId;
  /** The role's number as the create flow shows it. */
  number: number;
  /** The label of the on-chain bytes32 role key. */
  roleKey: string;
  name: string;
  tagline: string;
  /** The role's prepopulated permissions, as the card groups them. */
  groups: IRolePermissionGroup[];
  /** Every permission of every group, in order. */
  permissions: IRolePermissionOption[];
}

// Membership changes execute as the Safe, and the Roles modifier only takes
// them from the Safe once governance has handed it the modifier's ownership
// (see activationProposal.ts).
const ROLE_ACTIVATION_NOTE =
  " Takes effect after the one-time governance activation offered on the vault's Permissions page.";
// The vault only takes settings changes from the Safe once governance has
// moved settings authority from the governor to it.
const SETTINGS_AUTHORITY_NOTE =
  " Takes effect once a governance proposal moves settings authority from the governor to the vault's Safe.";

const withFlatPermissions = (
  role: Omit<IVaultRoleDefinition, "permissions">,
): IVaultRoleDefinition => ({
  ...role,
  permissions: role.groups.flatMap((group) => group.permissions),
});

export const VAULT_ROLES: Record<VaultRoleId, IVaultRoleDefinition> = {
  admin: withFlatPermissions({
    id: "admin",
    number: 1,
    roleKey: ADMIN_ROLE_KEY_V2,
    name: "Admin",
    tagline: "Vault profile, whitelist, executor rotation and fee destinations",
    groups: [
      {
        id: "prepopulated",
        title: "Prepopulated permissions",
        defaultOn: true,
        permissions: [
          {
            key: "manageExecutorMembers",
            label: "Manage executor role members",
            hint:
              "Add or remove the addresses that hold the executor role." +
              ROLE_ACTIVATION_NOTE,
          },
          {
            key: "transferAdminRole",
            label: "Transfer admin role",
            hint:
              "Hand the admin role to another address: assign it to the new admin, then remove the old one." +
              ROLE_ACTIVATION_NOTE,
          },
          {
            key: "manageWhitelist",
            label: "Manage whitelist",
            hint:
              "Add or remove depositor addresses, and switch deposits between whitelist-only and open to anyone." +
              SETTINGS_AUTHORITY_NOTE,
          },
          {
            key: "updateMetadata",
            label: "Update vault metadata",
            hint:
              "Edit the vault's photo, description, strategist details and links." +
              SETTINGS_AUTHORITY_NOTE,
          },
          {
            key: "changeFeeDestinations",
            label: "Change fee destination addresses",
            hint:
              "Change where each fee is paid. The fee rates and periods stay locked. Only governance can change those." +
              SETTINGS_AUTHORITY_NOTE,
          },
        ],
      },
    ],
  }),
  executor: withFlatPermissions({
    id: "executor",
    number: 2,
    roleKey: EXECUTOR_ROLE_KEY_V2,
    name: "Executor",
    tagline: "Vault positions, NAV, flows and fees",
    groups: [
      {
        id: "operations",
        title: "Prepopulated permissions",
        defaultOn: true,
        permissions: [
          {
            key: "sendFunds",
            label: "Send funds to admin contract & settle flows",
            hint:
              "Move the base asset from the Safe to the vault's admin contract so deposits and redemptions can settle.",
          },
          {
            key: "collectFees",
            label: "Collect fee",
            hint: "Mint the fees the vault has accrued to its fee destinations.",
          },
          {
            key: "updateNav",
            label: "Update NAV",
            hint: "Run the vault's NAV methods and store the new NAV.",
          },
          {
            key: "selfRevoke",
            label: "Self-revoke role",
            hint:
              "Step down from the executor role. Executors can only remove an executor, never add one." +
              ROLE_ACTIVATION_NOTE,
          },
        ],
      },
    ],
  }),
};

export const VAULT_ROLE_ORDER: VaultRoleId[] = ["admin", "executor"];

/**
 * The executor's card for a vault whose executor key is `roleKey`: one of
 * EXECUTOR_ROLE_KEY_ALIASES_V2, whichever the vault was created with.
 */
export const executorRoleDefinition = (roleKey: string): IVaultRoleDefinition =>
  roleKey === VAULT_ROLES.executor.roleKey
    ? VAULT_ROLES.executor
    : { ...VAULT_ROLES.executor, roleKey };

/** What the generators need to know about the vault being created. */
export interface IPrepopulatedPermissionsContext {
  fundAddress: string;
  baseToken: string;
  rolesModifier: string;
  /** Required while "Update NAV" is on. */
  navExecutor?: string;
  /** Required while "Collect fee" is on. */
  poolPerformanceFee?: string;
  /**
   * The executor key the vault was created with (see
   * resolveExecutorRoleKey); EXECUTOR_ROLE_KEY_V2 when omitted.
   */
  executorRoleKey?: string;
  /**
   * The raw Settings struct the factory will store (the init cache's
   * fundSettings), never derived frontend state: the admin's settings
   * permission pins to these values exactly.
   */
  rawSettings: Record<string, any>;
  /** The raw metadata JSON string, pinned while metadata is closed. */
  fundMetadata?: string;
  feePerformancePeriod: any;
  feeManagePeriod: any;
}

/**
 * The scopes the executor's switches own, by switch. Shared with the
 * Permissions step's protocol diff, which must leave them alone: the base
 * token is usually also a lending reserve, and these switches' own on/off
 * logic decides its transfer grant.
 */
export const executorPrepopulatedScopes = (
  context: Pick<
    IPrepopulatedPermissionsContext,
    "fundAddress" | "baseToken" | "rolesModifier"
  >,
): Record<keyof IExecutorPermissions, IPermissionScope> => ({
  sendFunds: { target: context.baseToken, selector: TRANSFER_SELECTOR },
  collectFees: {
    target: context.fundAddress,
    selector: FUND_FLOWS_CALL_SELECTOR,
  },
  updateNav: {
    target: context.fundAddress,
    selector: EXECUTE_NAV_UPDATE_SELECTOR,
  },
  selfRevoke: {
    target: context.rolesModifier,
    selector: ASSIGN_ROLES_SELECTOR,
  },
});

/** The scopes the admin's switches own: vault settings and membership. */
export const adminPrepopulatedScopes = (
  context: Pick<IPrepopulatedPermissionsContext, "fundAddress" | "rolesModifier">,
): IPermissionScope[] => [
  { target: context.fundAddress, selector: UPDATE_SETTINGS_SELECTOR },
  { target: context.rolesModifier, selector: ASSIGN_ROLES_SELECTOR },
];

/**
 * The scopes a role's switches decide, each under its switch's name. A
 * custom role has no switches, and so none.
 */
export const prepopulatedScopeLabels = (
  roleKey: string,
  context: Pick<
    IPrepopulatedPermissionsContext,
    "fundAddress" | "baseToken" | "rolesModifier"
  >,
): { scope: IPermissionScope; label: string }[] => {
  if (isExecutorRoleKey(roleKey)) {
    const scopes = executorPrepopulatedScopes(context);
    return (Object.keys(scopes) as (keyof IExecutorPermissions)[]).map((key) => ({
      scope: scopes[key],
      label:
        VAULT_ROLES.executor.permissions.find((option) => option.key === key)?.label ?? key,
    }));
  }
  if (roleKey === ADMIN_ROLE_KEY_V2) {
    const [settings, membership] = adminPrepopulatedScopes(context);
    return [
      { scope: membership, label: "Role management" },
      { scope: settings, label: "Vault settings" },
    ];
  }
  return [];
};

/** Letters, digits, dash and underscore; short enough for a bytes32 key. */
const CUSTOM_ROLE_NAME = /^[A-Za-z0-9_-]{1,31}$/;

/**
 * Why a name cannot be used for a custom role, or "" when it can. The name
 * IS the role's on-chain key (as a bytes32 string), so it has to fit one and
 * must not collide with a role the vault already has.
 */
export const customRoleNameError = (name: string, taken: string[]): string => {
  const trimmed = name.trim();
  if (!trimmed) return "Give the role a name.";
  if (!CUSTOM_ROLE_NAME.test(trimmed)) {
    return "Use up to 31 letters, digits, dashes or underscores, without spaces.";
  }
  const lower = trimmed.toLowerCase();
  const reserved = [
    ADMIN_ROLE_KEY_V2,
    ...EXECUTOR_ROLE_KEY_ALIASES_V2,
    "admin",
    "executor",
  ].map((key) => key.toLowerCase());
  if (reserved.includes(lower) || taken.some((key) => key.toLowerCase() === lower)) {
    return "The vault already has a role with that name.";
  }
  return "";
};

export interface ICustomRole {
  /** The key as the generators take it: its label, or the hex when it has none. */
  roleKey: string;
  /** The bytes32 key the modifier stores. */
  keyBytes: string;
  name: string;
  /** Role 3, 4, … in the order the roles appear. */
  number: number;
  /** Whether the modifier already knows it: someone holds it, or it is granted something. */
  stored: boolean;
}

// Every spelling of the executor's key is built in: whichever one a vault
// holds is shown as its executor, not as a role of its own.
const BUILT_IN_ROLE_KEYS = [ADMIN_ROLE_KEY_V2, ...EXECUTOR_ROLE_KEY_ALIASES_V2].map(
  (key) => toRoleKeyBytes32(key).toLowerCase(),
);

/**
 * The vault's custom roles: every role the modifier knows besides the two
 * built-in ones, then the ones added on the Permissions step that nothing has been
 * stored for yet (a role only exists on chain once it has a member or a
 * grant).
 */
export const resolveCustomRoles = (
  liveRoleKeys: string[],
  draftNames: string[],
): ICustomRole[] => {
  const roles: Omit<ICustomRole, "number">[] = [];
  // The zero key is never a role: the modifier refuses to authorize it
  // (NoMembership), so nothing assigned or granted under it can be used.
  const seen = new Set([...BUILT_IN_ROLE_KEYS, ethers.ZeroHash]);

  for (const key of liveRoleKeys) {
    const keyBytes = key.toLowerCase();
    if (seen.has(keyBytes)) continue;
    seen.add(keyBytes);
    let label = "";
    try {
      const decoded = ethers.decodeBytes32String(keyBytes);
      // Only a key that round-trips is safe to hand around as its label.
      if (
        /^[\x21-\x7E]+$/.test(decoded) &&
        ethers.encodeBytes32String(decoded).toLowerCase() === keyBytes
      ) {
        label = decoded;
      }
    } catch {
      // not a string key, keep the hex
    }
    roles.push({
      roleKey: label || keyBytes,
      keyBytes,
      name: label || `${keyBytes.slice(0, 10)}…`,
      stored: true,
    });
  }

  for (const name of draftNames) {
    let keyBytes = "";
    try {
      keyBytes = ethers.encodeBytes32String(name).toLowerCase();
    } catch {
      continue;
    }
    if (seen.has(keyBytes)) continue;
    seen.add(keyBytes);
    roles.push({ roleKey: name, keyBytes, name, stored: false });
  }

  return roles.map((role, i) => ({ ...role, number: 3 + i }));
};

/** A custom role as a card: it has members, and no switches of its own. */
export const customRoleDefinition = (
  roleKey: string,
  name: string,
  number: number,
): IVaultRoleDefinition => ({
  // A custom role is not one of the two built-in ids; the card only reads
  // the display fields.
  id: "executor",
  number,
  roleKey,
  name,
  tagline: "Custom role. It may do what is added for it below",
  groups: [],
  permissions: [],
});

export interface IPrepopulatedPermissionsBatch {
  /** Goes first, so an explicit grant later in the batch still wins. */
  revokes: string[];
  grants: string[];
}

/**
 * The switches' batch: the prepopulated permissions of both built-in roles.
 *
 * Saving is authoritative in both directions: a switch that is off is
 * REVOKED, not merely left out, so turning one off after an earlier save
 * actually takes it back (the revoke is a no-op on a grant that never
 * existed).
 *
 * Only functions are revoked, never a target's clearance. The targets these
 * switches use are shared with what the Permissions step grants — the base
 * token is usually also a lending reserve — and clearing one would silently
 * switch those grants off too. Revoking the function is the whole
 * revocation: a target left scoped with no function scoped on it allows
 * nothing. That also keeps this batch a pure function of the switches, with
 * no read of the modifier's state to go stale or fail.
 */
export const buildPrepopulatedPermissionsBatch = (
  context: IPrepopulatedPermissionsContext,
  permissions: IVaultRolePermissions,
): IPrepopulatedPermissionsBatch => {
  const { executor } = permissions;
  // A vault without an admin role is one whose admin has every switch off:
  // the same revocations apply, so disabling it after an earlier save takes
  // back what that save granted.
  const admin: IAdminPermissions = permissions.adminEnabled
    ? permissions.admin
    : {
      updateMetadata: false,
      manageWhitelist: false,
      manageExecutorMembers: false,
      transferAdminRole: false,
      changeFeeDestinations: false,
    };
  const { fundAddress, baseToken, rolesModifier } = context;
  const executorRoleKey = context.executorRoleKey ?? EXECUTOR_ROLE_KEY_V2;

  // --- Executor (role 2) ---
  const executorScopes = executorPrepopulatedScopes(context);
  const executorKeys = Object.keys(executorScopes) as (keyof IExecutorPermissions)[];
  const executorRevokes = buildRevokeFunctionEntriesV2(
    [
      ...executorKeys
        .filter((key) => !executor[key])
        .map((key) => executorScopes[key]),
      // Settings belong to the admin. A vault that saved this step before
      // the admin role existed granted updateSettings to the executor, and an
      // authoritative save has to take that back.
      { target: fundAddress, selector: UPDATE_SETTINGS_SELECTOR },
    ],
    executorRoleKey,
  );

  const executorGrants: string[] = [];
  if (executor.updateNav) {
    if (!context.navExecutor) {
      throw new Error(
        "Could not create the Update NAV permission: missing NAV executor address.",
      );
    }
    executorGrants.push(
      ...generateNAVPermissionRolesV2(
        fundAddress,
        context.navExecutor,
        executorRoleKey,
      ),
    );
  }
  if (executor.sendFunds) {
    executorGrants.push(
      ...generateSendFundsPermissionRolesV2(
        baseToken,
        fundAddress,
        executorRoleKey,
      ),
    );
  }
  if (executor.collectFees) {
    if (!context.poolPerformanceFee) {
      throw new Error(
        "Could not create the Collect fee permission: missing performance fee contract address for this chain.",
      );
    }
    executorGrants.push(
      ...generateCollectFeesPermissionRolesV2(
        fundAddress,
        context.poolPerformanceFee,
        executorRoleKey,
      ),
    );
  }
  if (executor.selfRevoke) {
    // Removals of the executor role only. This also replaces the wildcarded
    // assignRoles an earlier save may have stored for the same selector.
    executorGrants.push(
      ...generateAssignRolesPermissionRolesV2(
        rolesModifier,
        executorRoleKey,
        { roleKeys: [executorRoleKey], memberOf: false },
      ),
    );
  }

  // --- Admin (role 1) ---
  const open = {
    metadata: admin.updateMetadata,
    whitelist: admin.manageWhitelist,
    feeDestinations: admin.changeFeeDestinations,
  };
  const grantsSettings = open.metadata || open.whitelist || open.feeDestinations;
  const manageableRoles = [
    ...(admin.manageExecutorMembers ? [executorRoleKey] : []),
    ...(admin.transferAdminRole ? [ADMIN_ROLE_KEY_V2] : []),
  ];

  const adminRevokes = buildRevokeFunctionEntriesV2(
    [
      ...(grantsSettings
        ? []
        : [{ target: fundAddress, selector: UPDATE_SETTINGS_SELECTOR }]),
      ...(manageableRoles.length
        ? []
        : [{ target: rolesModifier, selector: ASSIGN_ROLES_SELECTOR }]),
    ],
    ADMIN_ROLE_KEY_V2,
  );

  const adminGrants: string[] = [];
  if (grantsSettings) {
    const pinned = parseUpdateSettingsPinnedValues(
      context.rawSettings,
      context.feePerformancePeriod,
      context.feeManagePeriod,
      context.fundMetadata,
    );
    adminGrants.push(
      ...generateUpdateSettingsPermissionRolesV2(
        fundAddress,
        pinned,
        ADMIN_ROLE_KEY_V2,
        open,
      ),
    );
  }
  if (manageableRoles.length) {
    adminGrants.push(
      ...generateAssignRolesPermissionRolesV2(rolesModifier, ADMIN_ROLE_KEY_V2, {
        roleKeys: manageableRoles,
      }),
    );
  }

  return {
    revokes: [...executorRevokes, ...adminRevokes],
    grants: [...executorGrants, ...adminGrants],
  };
};
