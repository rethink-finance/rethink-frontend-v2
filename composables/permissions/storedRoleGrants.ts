import {
  ADMIN_ROLE_KEY_V2,
  EXECUTOR_ROLE_KEY_ALIASES_V2,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";
import {
  parseRawPermissionCode,
  type IRawPermissionCodeEntry,
} from "~/composables/permissions/parseRawPermissionCode";
import { describeQueuedCalls } from "~/composables/permissions/rawPermissionQueue";
import {
  listLiveRoleKeys,
  replayEnabledModules,
  replayRoleMembers,
  storedRolePermissionCalls,
  type IRoleScopeLog,
} from "~/composables/permissions/roleScopeLogs";
import { RolesV2Operator } from "~/composables/permissions/rolesV2Permissions";
import { VAULT_ROLES, resolveCustomRoles } from "~/composables/permissions/vaultRoles";
import {
  formatRoleKey,
  type IConditionNode,
} from "~/composables/proposal/describeProposalActions";

/**
 * Every role a Roles V2 modifier knows, with what it may do: the view the
 * vault's Permissions tab shows. All of it comes from the modifier's own
 * event log (the contract has no getter for a role's grants), folded by
 * roleScopeLogs.ts; this only arranges the result per role.
 */

export type StoredRoleKind = "admin" | "executor" | "custom";

/** How an allowance is drawn down by the conditions that name it. */
export type AllowanceUse = "amount" | "ether" | "calls";

export interface IStoredRoleView {
  /** The bytes32 key, lowercase. */
  keyBytes: string;
  /** The key as a decoded Roles call prints it ("adminRole", "defaulManagerRole"). */
  label: string;
  kind: StoredRoleKind;
  /** Role 1 (admin), 2 (executor), then 3, 4, … for the custom roles. */
  number: number;
  name: string;
  /** Who holds the role now. */
  members: string[];
  /**
   * Of those, the ones whose module the modifier has disabled: still
   * members, but every call they make is refused.
   */
  disabledMembers: string[];
  /** The calls that would grant exactly what the role holds now. */
  entries: IRawPermissionCodeEntry[];
  /** Contracts the role is let into. */
  contracts: number;
  /** Of those, the ones open for any function. */
  openContracts: number;
  /** Of those, the ones opened with no function allowed: nothing gets through. */
  emptyTargets: string[];
  /** Functions allowed one by one, with or without limits. */
  functions: number;
  /** Allowances the role's limits draw on, by lowercase key. */
  allowances: { key: string; use: AllowanceUse }[];
}

const ALLOWANCE_USES: Partial<Record<RolesV2Operator, AllowanceUse>> = {
  [RolesV2Operator.WithinAllowance]: "amount",
  [RolesV2Operator.EtherWithinAllowance]: "ether",
  [RolesV2Operator.CallWithinAllowance]: "calls",
};

/** The allowances a condition tree draws on. */
const allowancesIn = (
  node: IConditionNode | undefined,
  found: { key: string; use: AllowanceUse }[],
) => {
  if (!node) return;
  const use = ALLOWANCE_USES[node.operator as RolesV2Operator];
  if (use) {
    const key = String(node.compValue).toLowerCase();
    if (!found.some((entry) => entry.key === key && entry.use === use)) {
      found.push({ key, use });
    }
  }
  node.children.forEach((child) => allowancesIn(child, found));
};

const buildView = (
  logs: IRoleScopeLog[],
  members: Map<string, string[]>,
  enabledModules: Set<string>,
  role: Pick<IStoredRoleView, "keyBytes" | "kind" | "number" | "name">,
): IStoredRoleView => {
  const calls = storedRolePermissionCalls(logs, role.keyBytes);
  const entries = calls.length ? parseRawPermissionCode(JSON.stringify(calls)) : [];

  const allowances: IStoredRoleView["allowances"] = [];
  // Lowercase target → its address and how many functions it allows.
  const scopedTargets = new Map<string, { address: string; functions: number }>();
  let contracts = 0;
  let openContracts = 0;
  let functions = 0;

  for (const { description } of describeQueuedCalls(entries)) {
    const target = description.target ?? "";
    switch (description.action) {
      case "scope-target":
        contracts++;
        scopedTargets.set(target.toLowerCase(), { address: target, functions: 0 });
        break;
      case "allow-target":
        contracts++;
        openContracts++;
        break;
      case "allow-function":
      case "scope-function": {
        functions++;
        const scoped = scopedTargets.get(target.toLowerCase());
        if (scoped) scoped.functions++;
        allowancesIn(description.conditions, allowances);
        break;
      }
    }
  }

  const held = members.get(role.keyBytes) ?? [];
  return {
    keyBytes: role.keyBytes,
    label: formatRoleKey(role.keyBytes),
    kind: role.kind,
    number: role.number,
    name: role.name,
    members: held,
    disabledMembers: held.filter((member) => !enabledModules.has(member.toLowerCase())),
    entries,
    contracts,
    openContracts,
    emptyTargets: [...scopedTargets.values()]
      .filter((target) => target.functions === 0)
      .map((target) => target.address),
    functions,
    allowances,
  };
};

/**
 * The modifier's live roles, as the Permissions tab lists them: the admin,
 * the executor (under whichever spelling of its key the vault was created
 * with, and under both if both are in use), then every other role in the
 * order it first appears in the log. A role is live while someone holds it
 * or it is let into at least one contract (listLiveRoleKeys); one that only
 * keeps function grants on contracts it can no longer reach is not listed,
 * since those let nothing through. Nor is the zero key, which the modifier
 * never authorizes.
 */
export const buildStoredRoleViews = (logs: IRoleScopeLog[]): IStoredRoleView[] => {
  const liveKeys = listLiveRoleKeys(logs).map((key) => key.toLowerCase());
  const members = replayRoleMembers(logs);
  const enabledModules = replayEnabledModules(logs);
  const isLive = (key: string) => liveKeys.includes(toRoleKeyBytes32(key).toLowerCase());
  const view = (role: Pick<IStoredRoleView, "keyBytes" | "kind" | "number" | "name">) =>
    buildView(logs, members, enabledModules, role);
  const views: IStoredRoleView[] = [];

  if (isLive(ADMIN_ROLE_KEY_V2)) {
    views.push(
      view({
        keyBytes: toRoleKeyBytes32(ADMIN_ROLE_KEY_V2).toLowerCase(),
        kind: "admin",
        number: VAULT_ROLES.admin.number,
        name: VAULT_ROLES.admin.name,
      }),
    );
  }
  for (const alias of EXECUTOR_ROLE_KEY_ALIASES_V2) {
    if (!isLive(alias)) continue;
    views.push(
      view({
        keyBytes: toRoleKeyBytes32(alias).toLowerCase(),
        kind: "executor",
        number: VAULT_ROLES.executor.number,
        name: VAULT_ROLES.executor.name,
      }),
    );
  }
  for (const role of resolveCustomRoles(liveKeys, [])) {
    views.push(
      view({
        keyBytes: role.keyBytes,
        kind: "custom",
        number: role.number,
        name: role.name,
      }),
    );
  }
  return views;
};
