import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import type { IPermissionScope } from "~/composables/permissions/revokePermissions";

/**
 * The fold that turns a Roles modifier's permission events into what a role
 * currently grants. Fetching the log (and judging its freshness) is
 * services/onchain/roleScopes.ts; this half has no store behind it.
 */

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

/** The six events that move a role's target/function grants. */
const SCOPE_EVENT_NAMES = [
  "AllowTarget",
  "ScopeTarget",
  "RevokeTarget",
  "AllowFunction",
  "ScopeFunction",
  "RevokeFunction",
] as const;

const scopeEventTopics = new Set(
  SCOPE_EVENT_NAMES.map(
    (name) => rolesInterface.getEvent(name)!.topicHash.toLowerCase(),
  ),
);

/** The raw log fields the replay needs, however the log was fetched. */
export interface IRoleScopeLog {
  topics: readonly string[];
  data: string;
  blockNumber: number;
  logIndex: number;
}

export interface ICurrentRoleScopes {
  /**
   * Every (target, selector) with a stored function grant. RevokeTarget does
   * not clear these on-chain — the modifier only drops the target clearance,
   * and a later scopeTarget would bring the stored grants back to life — so
   * the replay keeps them across RevokeTarget too, and an authoritative save
   * revokes them explicitly.
   */
  scopes: IPermissionScope[];
  /** Targets with a live clearance (wildcard-allowed or scoped). */
  targets: string[];
  /** Highest block among the modifier's permission logs; 0 when none. */
  latestBlock: number;
}

/**
 * Fold the modifier's permission logs into the role's current grants,
 * mirroring the contract's storage semantics: clearances are last-write-wins
 * per target, function grants live in their own map keyed by
 * (target, selector) and only RevokeFunction deletes them.
 */
export const reduceRoleScopeLogs = (
  logs: IRoleScopeLog[],
  roleKeyBytes: string,
): ICurrentRoleScopes => {
  const roleKeyLower = roleKeyBytes.toLowerCase();
  const sorted = [...logs].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );

  // Lowercased key → original-cased value, so callers get real addresses
  // back while matching stays case-insensitive.
  const clearances = new Map<string, string>();
  const grants = new Map<string, IPermissionScope>();
  let latestBlock = 0;

  for (const log of sorted) {
    const topic = (log.topics?.[0] ?? "").toLowerCase();
    if (!scopeEventTopics.has(topic)) continue;
    const parsed = rolesInterface.parseLog({
      topics: [...log.topics],
      data: log.data,
    });
    if (!parsed) continue;
    // Any permission event proves how far this source has read, whichever
    // role it touches — the floor check compares against this.
    latestBlock = Math.max(latestBlock, log.blockNumber);
    if (String(parsed.args.roleKey).toLowerCase() !== roleKeyLower) continue;

    const target = String(parsed.args.targetAddress);
    const targetLower = target.toLowerCase();
    switch (parsed.name) {
      case "AllowTarget":
      case "ScopeTarget":
        clearances.set(targetLower, target);
        break;
      case "RevokeTarget":
        clearances.delete(targetLower);
        break;
      case "AllowFunction":
      case "ScopeFunction": {
        const selector = String(parsed.args.selector);
        grants.set(`${targetLower}:${selector.toLowerCase()}`, {
          target,
          selector,
        });
        break;
      }
      case "RevokeFunction": {
        const selector = String(parsed.args.selector);
        grants.delete(`${targetLower}:${selector.toLowerCase()}`);
        break;
      }
    }
  }

  return {
    scopes: [...grants.values()],
    targets: [...clearances.values()],
    latestBlock,
  };
};


/**
 * What a role is granted right now, written back out as the calls that would
 * grant it: one scopeTarget (or allowTarget) per contract the role is let
 * into, followed by that contract's allowFunction / scopeFunction calls with
 * their stored conditions. The Roles modifier has no getter for any of this;
 * the events carry the full arguments, so the replay is exact.
 *
 * Only what is in effect is returned. A function grant stored for a target
 * whose clearance was revoked lets nothing through, and a target cleared
 * wholesale (allowTarget) ignores function-level grants; both are left out.
 */
export const storedRolePermissionCalls = (
  logs: IRoleScopeLog[],
  roleKeyBytes: string,
): string[] => {
  const roleKeyLower = roleKeyBytes.toLowerCase();
  const sorted = [...logs].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );

  interface IStoredTarget {
    address: string;
    wildcard: boolean;
    options: number;
  }
  interface IStoredFunction {
    target: string;
    selector: string;
    /** Absent for a wildcarded function (allowFunction). */
    conditions?: [number, number, number, string][];
    options: number;
  }
  const targets = new Map<string, IStoredTarget>();
  const functions = new Map<string, IStoredFunction>();

  for (const log of sorted) {
    const topic = (log.topics?.[0] ?? "").toLowerCase();
    if (!scopeEventTopics.has(topic)) continue;
    const parsed = rolesInterface.parseLog({
      topics: [...log.topics],
      data: log.data,
    });
    if (!parsed) continue;
    if (String(parsed.args.roleKey).toLowerCase() !== roleKeyLower) continue;

    const target = String(parsed.args.targetAddress);
    const targetLower = target.toLowerCase();
    const functionKey = () =>
      `${targetLower}:${String(parsed.args.selector).toLowerCase()}`;
    switch (parsed.name) {
      case "AllowTarget":
        // Re-set, so a contract re-opened later lists where it was re-opened.
        targets.delete(targetLower);
        targets.set(targetLower, {
          address: target,
          wildcard: true,
          options: Number(parsed.args.options),
        });
        break;
      case "ScopeTarget":
        if (!targets.has(targetLower) || targets.get(targetLower)!.wildcard) {
          targets.delete(targetLower);
          targets.set(targetLower, { address: target, wildcard: false, options: 0 });
        }
        break;
      case "RevokeTarget":
        targets.delete(targetLower);
        break;
      case "AllowFunction":
        functions.set(functionKey(), {
          target,
          selector: String(parsed.args.selector),
          options: Number(parsed.args.options),
        });
        break;
      case "ScopeFunction":
        functions.set(functionKey(), {
          target,
          selector: String(parsed.args.selector),
          conditions: [...parsed.args.conditions].map((condition: any) => [
            Number(condition.parent),
            Number(condition.paramType),
            Number(condition.operator),
            String(condition.compValue),
          ]),
          options: Number(parsed.args.options),
        });
        break;
      case "RevokeFunction":
        functions.delete(functionKey());
        break;
    }
  }

  const calls: string[] = [];
  for (const [targetLower, target] of targets) {
    if (target.wildcard) {
      calls.push(
        rolesInterface.encodeFunctionData("allowTarget", [
          roleKeyBytes,
          target.address,
          target.options,
        ]),
      );
      continue;
    }
    calls.push(
      rolesInterface.encodeFunctionData("scopeTarget", [roleKeyBytes, target.address]),
    );
    for (const fn of functions.values()) {
      if (fn.target.toLowerCase() !== targetLower) continue;
      calls.push(
        fn.conditions
          ? rolesInterface.encodeFunctionData("scopeFunction", [
            roleKeyBytes,
            fn.target,
            fn.selector,
            fn.conditions,
            fn.options,
          ])
          : rolesInterface.encodeFunctionData("allowFunction", [
            roleKeyBytes,
            fn.target,
            fn.selector,
            fn.options,
          ]),
      );
    }
  }
  return calls;
};

const assignRolesTopic = rolesInterface.getEvent("AssignRoles")!.topicHash.toLowerCase();

/**
 * The role keys that are in use on the modifier right now — held by someone,
 * or granted something — in the order each first appears in its log. A Roles
 * modifier has no list of roles: a role exists exactly as long as either is
 * true, so a key whose members were all removed and whose grants were all
 * revoked is no longer one.
 */
export const listLiveRoleKeys = (logs: IRoleScopeLog[]): string[] => {
  const sorted = [...logs].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );
  const seen: string[] = [];
  const members = new Map<string, Set<string>>();
  const note = (key: string) => {
    const lower = key.toLowerCase();
    if (!seen.includes(lower)) seen.push(lower);
    return lower;
  };

  for (const log of sorted) {
    const topic = (log.topics?.[0] ?? "").toLowerCase();
    if (topic !== assignRolesTopic && !scopeEventTopics.has(topic)) continue;
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = rolesInterface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      parsed = null;
    }
    if (!parsed) continue;
    if (parsed.name === "AssignRoles") {
      const module = String(parsed.args.module).toLowerCase();
      [...parsed.args.roleKeys].forEach((roleKey: string, i: number) => {
        const key = note(String(roleKey));
        if (!members.has(key)) members.set(key, new Set());
        if (parsed!.args.memberOf[i]) members.get(key)!.add(module);
        else members.get(key)!.delete(module);
      });
    } else {
      note(String(parsed.args.roleKey));
    }
  }

  return seen.filter((key) => {
    if (members.get(key)?.size) return true;
    const granted = reduceRoleScopeLogs(sorted, key);
    return granted.targets.length > 0;
  });
};
