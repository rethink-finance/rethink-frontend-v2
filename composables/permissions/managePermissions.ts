import { ethers } from "ethers";
import {
  ADMIN_ROLE_KEY_V2,
  generateNAVPermissionRolesV2,
  isExecutorRoleKey,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import { describeQueuedCalls } from "~/composables/permissions/rawPermissionQueue";
import {
  buildRevokeEntriesV2,
  buildRevokeFunctionEntriesV2,
  type IPermissionScope,
} from "~/composables/permissions/revokePermissions";
import {
  ASSIGN_ROLES_SELECTOR,
  UPDATE_SETTINGS_SELECTOR,
  generateAssignRolesPermissionRolesV2,
  generateCollectFeesPermissionRolesV2,
  generateSendFundsPermissionRolesV2,
  generateUpdateSettingsPermissionRolesV2,
  parseUpdateSettingsPinnedValues,
} from "~/composables/permissions/rolesV2Permissions";
import type { IStoredRoleView } from "~/composables/permissions/storedRoleGrants";
import {
  executorPrepopulatedScopes,
  prepopulatedScopeLabels,
  VAULT_ROLES,
  type IPrepopulatedPermissionsContext,
} from "~/composables/permissions/vaultRoles";
import { resolveKnownFunction } from "~/composables/proposal/decodeProposalCallData";
import {
  describeConditionTree,
  findExtraSignature,
  type IConditionNode,
} from "~/composables/proposal/describeProposalActions";
import { coreWriterActionNames } from "~/composables/permissions/coreWriterPatterns";
import { CORE_WRITER, type IContractProtocol } from "~/composables/contracts/contractNames";

/**
 * The Permissions tab's manage mode, in pure functions: which stored grants a
 * "Remove" press takes away, the Roles calls that take them away, and who may
 * change a role's members. The page owns the state; these only compute.
 */

export { ASSIGN_ROLES_SELECTOR };

const TARGET_ACTIONS = new Set(["scope-target", "allow-target"]);
const FUNCTION_ACTIONS = new Set(["scope-function", "allow-function"]);
/** A selector the zero-scope convention uses for a whole-target grant. */
const WHOLE_TARGET = "0x00000000";

const lower = (value?: string) => (value ?? "").toLowerCase();

/** The stored calls a Remove press can act on: grants, not anything else. */
export const removableIndices = (entries: IRawPermissionCodeEntry[]): number[] =>
  describeQueuedCalls(entries)
    .filter(({ description }) =>
      TARGET_ACTIONS.has(description.action) || FUNCTION_ACTIONS.has(description.action),
    )
    .map(({ index }) => index);

/**
 * What a Remove press on `pressed` actually removes. Removing a contract
 * removes everything on it; removing its last function also clears the
 * contract, so it stops showing up as an empty grant.
 */
export const expandRemoval = (
  entries: IRawPermissionCodeEntry[],
  pressed: number[],
): number[] => {
  const calls = describeQueuedCalls(entries);
  const removed = new Set(pressed);

  const contracts = new Set(
    calls
      .filter(({ index, description }) => removed.has(index) && TARGET_ACTIONS.has(description.action))
      .map(({ description }) => lower(description.target)),
  );
  for (const { index, description } of calls) {
    if (contracts.has(lower(description.target)) && FUNCTION_ACTIONS.has(description.action)) {
      removed.add(index);
    }
  }

  // A contract whose functions are all being removed goes with them.
  const byTarget = new Map<string, number[]>();
  for (const { index, description } of calls) {
    if (!FUNCTION_ACTIONS.has(description.action)) continue;
    const key = lower(description.target);
    byTarget.set(key, [...(byTarget.get(key) ?? []), index]);
  }
  for (const { index, description } of calls) {
    if (description.action !== "scope-target") continue;
    const functions = byTarget.get(lower(description.target)) ?? [];
    if (functions.length && functions.every((fn) => removed.has(fn))) removed.add(index);
  }

  return [...removed].sort((a, b) => a - b);
};

/**
 * The Roles calls that take `removed` (indices into the role's stored
 * calls) away from the role. A contract is only cleared when nothing else
 * the role keeps on it survives: revokeTarget is per contract, and clearing
 * a shared one would take the kept functions with it.
 */
export const buildRemovalCalls = (
  entries: IRawPermissionCodeEntry[],
  removed: number[],
  roleKey: string,
): string[] => {
  if (!removed.length) return [];
  const gone = new Set(removed);
  const revoked: IPermissionScope[] = [];
  const retained = new Set<string>();

  for (const { index, description } of describeQueuedCalls(entries)) {
    const target = description.target ?? "";
    if (!target) continue;
    const isFunction = FUNCTION_ACTIONS.has(description.action);
    const isOpenTarget = description.action === "allow-target";
    if (!isFunction && !isOpenTarget) continue;
    if (!gone.has(index)) {
      retained.add(target);
      continue;
    }
    revoked.push({
      target,
      selector: isFunction ? description.selector ?? WHOLE_TARGET : WHOLE_TARGET,
    });
  }

  // A contract removed outright (its scope-target row) with no function on
  // it still needs clearing.
  for (const { index, description } of describeQueuedCalls(entries)) {
    if (description.action !== "scope-target" || !gone.has(index) || !description.target) continue;
    if (!revoked.some((scope) => lower(scope.target) === lower(description.target))) {
      revoked.push({ target: description.target, selector: WHOLE_TARGET });
    }
  }

  const calls = buildRevokeEntriesV2(revoked, [...retained], roleKey);
  // revokeFunction on the zero selector is a no-op; only its paired
  // revokeTarget does anything, so it is not sent.
  const noop = new Set(
    revoked
      .filter((scope) => scope.selector === WHOLE_TARGET)
      .map((scope) => `${lower(scope.target)}`),
  );
  const rolesInterface = new ethers.Interface([
    "function revokeFunction(bytes32 roleKey, address targetAddress, bytes4 selector)",
  ]);
  return calls.filter((data) => {
    try {
      const parsed = rolesInterface.parseTransaction({ data });
      if (!parsed) return true;
      return !(parsed.args[2] === WHOLE_TARGET && noop.has(lower(parsed.args[1])));
    } catch {
      return true;
    }
  });
};

/**
 * The roles whose holders may change members: any role that may call
 * assignRoles on the modifier, or is open to any function on it. The exact
 * limits (which roles, adding or removing) are left to the modifier: the
 * page simulates each change before it is sent.
 */
export const rolesThatManageMembers = (
  views: IStoredRoleView[],
  rolesModAddress: string,
): IStoredRoleView[] =>
  views.filter((view) =>
    describeQueuedCalls(view.entries).some(({ description }) => {
      if (lower(description.target) !== lower(rolesModAddress)) return false;
      if (description.action === "allow-target") return true;
      return (
        FUNCTION_ACTIONS.has(description.action) &&
        lower(description.selector) === ASSIGN_ROLES_SELECTOR
      );
    }),
  );

/** Whether `account` may change members: the vault Safe, or a holder of such a role. */
export const canManageMembers = (
  account: string | undefined,
  options: { safeAddress?: string; managers: IStoredRoleView[] },
): boolean => {
  const who = lower(account);
  if (!who) return false;
  if (who === lower(options.safeAddress)) return true;
  return options.managers.some((view) =>
    view.members.some((member) => lower(member) === who) &&
    !view.disabledMembers.some((member) => lower(member) === who),
  );
};

/**
 * The order the tabs list roles in: by role number, so Admin (role 1) sits
 * left of Executor (role 2) as on the create flow. Which tab opens first is
 * the page's call (the executor).
 */
export const orderRolesForDisplay = (views: IStoredRoleView[]): IStoredRoleView[] =>
  [...views].sort((a, b) => a.number - b.number);

/* ---- Prepopulated permissions ----------------------------------------------- */

/** The vault's own contracts, which the prepopulated grants point at. */
export interface IVaultContracts {
  fundAddress: string;
  baseToken: string;
  rolesModifier: string;
}

/** One built-in grant of a role, as the create flow's switches made it. */
export interface IPrepopulatedGrant {
  /** The function it allows, on which contract. */
  scope: IPermissionScope;
  label: string;
  /** What it lets the role do, where one switch is the whole grant. */
  hint?: string;
  granted: boolean;
  /**
   * Where several switches share this grant (the admin's settings and
   * membership grants), each switch and whether the stored grant opens it.
   */
  switches?: { label: string; on: boolean }[];
}

export interface IPrepopulatedSplit {
  grants: IPrepopulatedGrant[];
  /** The role's stored calls that belong to its prepopulated grants. */
  prepopulated: IRawPermissionCodeEntry[];
  /** Everything else the role stores. */
  other: IRawPermissionCodeEntry[];
}

const scopeKey = (target?: string, selector?: string) => `${lower(target)}:${lower(selector)}`;

/** The compValues of a condition tree, for spotting a pinned value anywhere in it. */
const compValues = (node: IConditionNode | undefined): string[] =>
  node ? [lower(node.compValue), ...node.children.flatMap(compValues)] : [];

const settingsInputs = (): ethers.ParamType[] => {
  try {
    return (resolveKnownFunction(UPDATE_SETTINGS_SELECTOR)?.function.inputs ?? []).map(
      (input: any) => ethers.ParamType.from(input),
    );
  } catch {
    return [];
  }
};

/** Which settings fields a stored updateSettings grant leaves open. */
const openSettingsFields = (conditions: IConditionNode | undefined): Set<string> => {
  const open = new Set<string>();
  for (const line of describeConditionTree(conditions, settingsInputs())) {
    if (!line.muted || !line.label) continue;
    open.add(line.label.replace(/ \([^)]*\)$/, "").split(".").pop() ?? "");
  }
  return open;
};

/**
 * A role's stored calls split the way the create flow splits them: its
 * prepopulated grants (each with whether it is stored, and for a grant that
 * several switches share, which of them it opens) and everything else. A
 * contract's opening call goes with the prepopulated grants when every
 * function stored on it is one of them. A custom role has no prepopulated
 * grants, so everything it stores is "other".
 */
export const splitPrepopulated = (
  entries: IRawPermissionCodeEntry[],
  roleKey: string,
  contracts: IVaultContracts,
  executorRoleKey: string,
): IPrepopulatedSplit => {
  const labels = prepopulatedScopeLabels(roleKey, contracts);
  if (!labels.length) return { grants: [], prepopulated: [], other: entries };

  const calls = describeQueuedCalls(entries);
  const wanted = new Set(labels.map(({ scope }) => scopeKey(scope.target, scope.selector)));
  const isPrepopulated = (call: (typeof calls)[number]) =>
    FUNCTION_ACTIONS.has(call.description.action) &&
    wanted.has(scopeKey(call.description.target, call.description.selector));

  const prepopulated: IRawPermissionCodeEntry[] = [];
  const other: IRawPermissionCodeEntry[] = [];
  for (const call of calls) {
    let mine = isPrepopulated(call);
    if (!mine && call.description.action === "scope-target") {
      const functions = calls.filter(
        (fn) =>
          FUNCTION_ACTIONS.has(fn.description.action) &&
          lower(fn.description.target) === lower(call.description.target),
      );
      mine = functions.length > 0 && functions.every(isPrepopulated);
    }
    (mine ? prepopulated : other).push(entries[call.index]);
  }

  const storedFor = (scope: IPermissionScope) =>
    calls.find(
      (call) =>
        FUNCTION_ACTIONS.has(call.description.action) &&
        scopeKey(call.description.target, call.description.selector) ===
          scopeKey(scope.target, scope.selector),
    );

  const executorHints = Object.fromEntries(
    VAULT_ROLES.executor.permissions.map((option) => [option.label, option.hint]),
  );
  const adminLabel = (key: string) =>
    VAULT_ROLES.admin.permissions.find((option) => option.key === key)?.label ?? key;

  const grants = labels.map(({ scope, label }): IPrepopulatedGrant => {
    const stored = storedFor(scope);
    const granted = !!stored;
    const unrestricted = stored?.description.action === "allow-function";
    const grant: IPrepopulatedGrant = { scope, label, granted, hint: executorHints[label] };
    if (isExecutorRoleKey(roleKey)) return grant;

    if (lower(scope.selector) === UPDATE_SETTINGS_SELECTOR) {
      const open = granted && !unrestricted ? openSettingsFields(stored.description.conditions) : null;
      const isOpen = (...fields: string[]) =>
        granted && (unrestricted || fields.some((field) => open?.has(field)));
      grant.switches = [
        { label: adminLabel("updateMetadata"), on: isOpen("_fundMetadata", "fundMetadata") },
        { label: adminLabel("manageWhitelist"), on: isOpen("allowedDepositAddrs", "isWhitelistedDeposits") },
        { label: adminLabel("changeFeeDestinations"), on: isOpen("feeCollectors") },
      ];
    } else if (lower(scope.selector) === ASSIGN_ROLES_SELECTOR) {
      const pinned = granted && !unrestricted ? compValues(stored.description.conditions).join(" ") : "";
      const names = (key: string) =>
        granted && (unrestricted || pinned.includes(toRoleKeyBytes32(key).toLowerCase().slice(2)));
      grant.switches = [
        { label: adminLabel("manageExecutorMembers"), on: names(executorRoleKey) },
        { label: adminLabel("transferAdminRole"), on: names(ADMIN_ROLE_KEY_V2) },
      ];
    }
    return grant;
  });

  return { grants, prepopulated, other };
};

/**
 * Taking prepopulated grants away: their functions only. The contracts they
 * sit on are shared with the vault's other grants (the vault address carries
 * NAV, fees and settings), so they are left scoped, which on its own allows
 * nothing. Same rule as the create flow's switches.
 */
export const buildPrepopulatedRemovalCalls = (
  scopes: IPermissionScope[],
  roleKey: string,
): string[] => (scopes.length ? buildRevokeFunctionEntriesV2(scopes, roleKey) : []);

/* ---- Vault operations as switches ------------------------------------------ */

/** One of the create flow's switches, on or off as the stored grants say. */
export interface IVaultOperationSwitch {
  key: string;
  label: string;
  /** The create flow's explanation of the switch. */
  hint: string;
  on: boolean;
}

/**
 * A built-in role's vault operations as the create flow's switches: the
 * executor's four (one grant each) and the admin's five (two shared grants).
 * A custom role has none.
 */
export const vaultOperationSwitches = (
  grants: IPrepopulatedGrant[],
  roleKey: string,
): IVaultOperationSwitch[] => {
  if (isExecutorRoleKey(roleKey)) {
    return VAULT_ROLES.executor.permissions.map((option) => ({
      key: option.key,
      label: option.label,
      hint: option.hint,
      on: grants.some((grant) => grant.label === option.label && grant.granted),
    }));
  }
  if (roleKey === ADMIN_ROLE_KEY_V2) {
    const states = new Map(
      grants.flatMap((grant) => (grant.switches ?? []).map((option) => [option.label, option.on])),
    );
    return VAULT_ROLES.admin.permissions.map((option) => ({
      key: option.key,
      label: option.label,
      hint: option.hint,
      on: !!states.get(option.label),
    }));
  }
  return [];
};

const SETTINGS_SWITCHES = ["updateMetadata", "manageWhitelist", "changeFeeDestinations"];
const MEMBERSHIP_SWITCHES = ["manageExecutorMembers", "transferAdminRole"];

/**
 * The Roles calls that take a role's vault operations from `current` to
 * `desired`, and nothing else: an untouched operation is not re-sent. Each
 * grant is written by the same generator the create flow uses, so a switch
 * turned on here stores exactly what the create flow would have.
 *
 * The admin's settings switches share one updateSettings grant, and its
 * membership switches one assignRoles grant: changing any switch of a group
 * re-issues that group's grant from all of its desired switches (scopeFunction
 * replaces the stored rule), or revokes it when none is left on. Settings are
 * pinned to the vault's live values, which the caller reads.
 */
export const buildVaultOperationCalls = (
  roleKey: string,
  current: Record<string, boolean>,
  desired: Record<string, boolean>,
  context: IPrepopulatedPermissionsContext,
): string[] => {
  const changed = (key: string) => !!current[key] !== !!desired[key];
  const calls: string[] = [];

  if (isExecutorRoleKey(roleKey)) {
    const scopes = executorPrepopulatedScopes(context);
    for (const key of Object.keys(scopes) as (keyof typeof scopes)[]) {
      if (!changed(key)) continue;
      if (!desired[key]) {
        calls.push(...buildRevokeFunctionEntriesV2([scopes[key]], roleKey));
        continue;
      }
      if (key === "updateNav") {
        if (!context.navExecutor) throw new Error("Update NAV needs the chain's NAV executor address.");
        calls.push(...generateNAVPermissionRolesV2(context.fundAddress, context.navExecutor, roleKey));
      } else if (key === "sendFunds") {
        calls.push(...generateSendFundsPermissionRolesV2(context.baseToken, context.fundAddress, roleKey));
      } else if (key === "collectFees") {
        if (!context.poolPerformanceFee) throw new Error("Collect fee needs the chain's performance fee contract.");
        calls.push(...generateCollectFeesPermissionRolesV2(context.fundAddress, context.poolPerformanceFee, roleKey));
      } else if (key === "selfRevoke") {
        calls.push(
          ...generateAssignRolesPermissionRolesV2(context.rolesModifier, roleKey, {
            roleKeys: [roleKey],
            memberOf: false,
          }),
        );
      }
    }
    return calls;
  }

  if (roleKey !== ADMIN_ROLE_KEY_V2) return calls;

  if (SETTINGS_SWITCHES.some(changed)) {
    const open = {
      metadata: !!desired.updateMetadata,
      whitelist: !!desired.manageWhitelist,
      feeDestinations: !!desired.changeFeeDestinations,
    };
    if (open.metadata || open.whitelist || open.feeDestinations) {
      const pinned = parseUpdateSettingsPinnedValues(
        context.rawSettings,
        context.feePerformancePeriod,
        context.feeManagePeriod,
        context.fundMetadata,
      );
      calls.push(...generateUpdateSettingsPermissionRolesV2(context.fundAddress, pinned, ADMIN_ROLE_KEY_V2, open));
    } else {
      calls.push(
        ...buildRevokeFunctionEntriesV2(
          [{ target: context.fundAddress, selector: UPDATE_SETTINGS_SELECTOR }],
          ADMIN_ROLE_KEY_V2,
        ),
      );
    }
  }

  if (MEMBERSHIP_SWITCHES.some(changed)) {
    const roleKeys = [
      ...(desired.manageExecutorMembers ? [context.executorRoleKey ?? ""] : []),
      ...(desired.transferAdminRole ? [ADMIN_ROLE_KEY_V2] : []),
    ].filter(Boolean);
    if (roleKeys.length) {
      calls.push(...generateAssignRolesPermissionRolesV2(context.rolesModifier, ADMIN_ROLE_KEY_V2, { roleKeys }));
    } else {
      calls.push(
        ...buildRevokeFunctionEntriesV2(
          [{ target: context.rolesModifier, selector: ASSIGN_ROLES_SELECTOR }],
          ADMIN_ROLE_KEY_V2,
        ),
      );
    }
  }
  return calls;
};

/* ---- Protocol access, grouped by protocol ------------------------------------ */

// What a function does, as a tag on its protocol's row.
const ACTION_TAGS: Record<string, string> = {
  deposit: "Supply",
  mint: "Supply",
  supply: "Supply",
  withdraw: "Withdraw",
  redeem: "Withdraw",
  borrow: "Borrow",
  repay: "Repay",
  approve: "Approve",
  transfer: "Transfer",
  transferFrom: "Transfer",
  depositV3: "Bridge",
  depositV3Now: "Bridge",
  depositFor: "Deposit",
  stake: "Stake",
  unstake: "Unstake",
  claim: "Claim",
  claimRewards: "Claim",
  swap: "Swap",
  unoswap: "Swap",
  unoswapTo: "Swap",
  exactInput: "Swap",
  exactInputSingle: "Swap",
};

// HyperCore's CoreWriter instructions, as tags.
const CORE_ACTION_TAGS: Record<string, string> = {
  usdClassTransfer: "Spot ↔ Perp",
  sendAsset: "Send",
  spotSend: "Send",
  addApiWallet: "API agent",
  limitOrder: "Trade",
  cancelOrderByOid: "Trade",
  cancelOrderByCloid: "Trade",
  vaultTransfer: "Vault transfer",
  tokenDelegate: "Stake",
  stakingDeposit: "Stake",
  stakingWithdraw: "Stake",
  borrowLend: "Lend",
  approveBuilderFee: "Builder fee",
};

const functionName = (selector?: string): string | undefined =>
  resolveKnownFunction(selector ?? "")?.function.name ?? findExtraSignature(selector)?.name;

const tagFor = (name: string) =>
  ACTION_TAGS[name] ??
  name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (first) => first.toUpperCase());

export interface IProtocolGroup {
  key: string;
  name: string;
  /** A DefiLlama protocol slug, a token symbol, or nothing (a plain contract). */
  logo?: IContractProtocol["logo"];
  /** The contracts of the protocol the role may call. */
  targets: string[];
  /** Indices into the entries this was built from. */
  indices: number[];
  /** What the role may do there, in a word each. */
  tags: string[];
}

/**
 * A role's permissions beyond its vault operations, one group per protocol:
 * every contract the protocol is known by, the actions allowed there as
 * tags, and which of the entries belong to it. A contract no protocol claims
 * is a group of its own, under whatever name it is known by.
 */
export const groupByProtocol = (
  entries: IRawPermissionCodeEntry[],
  protocolOf: (address: string) => IContractProtocol | undefined,
  nameOf: (address: string) => string,
): IProtocolGroup[] => {
  const groups = new Map<string, IProtocolGroup>();
  for (const { index, description } of describeQueuedCalls(entries)) {
    const target = description.target;
    if (!target) continue;
    const protocol = protocolOf(target);
    const key = protocol?.key ?? `contract:${lower(target)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: protocol?.name ?? nameOf(target),
        logo: protocol?.logo,
        targets: [],
        indices: [],
        tags: [],
      };
      groups.set(key, group);
    }
    if (!group.targets.some((known) => lower(known) === lower(target))) group.targets.push(target);
    group.indices.push(index);

    const tags: string[] = [];
    if (description.action === "allow-target") {
      tags.push("Any function");
    } else if (FUNCTION_ACTIONS.has(description.action)) {
      const name = functionName(description.selector);
      if (lower(target) === CORE_WRITER && name === "sendRawAction") {
        const actions = description.action === "scope-function"
          ? coreWriterActionNames(description.conditions)
          : undefined;
        tags.push(...(actions ? actions.map((action) => CORE_ACTION_TAGS[action] ?? tagFor(action)) : ["Any action"]));
      } else {
        tags.push(name ? tagFor(name) : "Other");
      }
    }
    for (const tag of tags) if (!group.tags.includes(tag)) group.tags.push(tag);
  }
  return [...groups.values()];
};
