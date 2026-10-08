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

/** The logs oldest first, the order the modifier applied them in. */
const inLogOrder = (logs: IRoleScopeLog[]): IRoleScopeLog[] =>
  [...logs].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

/** One modifier event decoded, or null for an event this ABI does not know. */
const parseRolesLog = (log: IRoleScopeLog): ethers.LogDescription | null => {
  try {
    return rolesInterface.parseLog({ topics: [...log.topics], data: log.data });
  } catch {
    return null;
  }
};

/**
 * Who holds each role right now, by lowercase bytes32 key: the modifier's
 * AssignRoles history replayed, the last write per (role, member) winning.
 * Addresses keep the casing the log gave them, in the order each was added.
 */
export const replayRoleMembers = (logs: IRoleScopeLog[]): Map<string, string[]> => {
  const members = new Map<string, Map<string, string>>();
  for (const log of inLogOrder(logs)) {
    if ((log.topics?.[0] ?? "").toLowerCase() !== assignRolesTopic) continue;
    const parsed = parseRolesLog(log);
    if (!parsed) continue;
    const module = String(parsed.args.module);
    [...parsed.args.roleKeys].forEach((roleKey: string, i: number) => {
      const key = String(roleKey).toLowerCase();
      if (!members.has(key)) members.set(key, new Map());
      if (parsed.args.memberOf[i]) members.get(key)!.set(module.toLowerCase(), module);
      else members.get(key)!.delete(module.toLowerCase());
    });
  }
  return new Map(
    [...members].map(([key, holders]) => [key, [...holders.values()]]),
  );
};

const enabledModuleTopic = rolesInterface.getEvent("EnabledModule")!.topicHash.toLowerCase();
const disabledModuleTopic = rolesInterface.getEvent("DisabledModule")!.topicHash.toLowerCase();

/**
 * The modules enabled on the modifier right now, lowercase. A role's member
 * is only let through while its module is enabled: disableModule leaves the
 * membership stored but every call from it is refused, until a later
 * enableModule brings it back without any AssignRoles event. assignRoles
 * enables the module it assigns, so an assignment counts as enabling too.
 */
export const replayEnabledModules = (logs: IRoleScopeLog[]): Set<string> => {
  const enabled = new Set<string>();
  for (const log of inLogOrder(logs)) {
    const topic = (log.topics?.[0] ?? "").toLowerCase();
    if (topic !== enabledModuleTopic && topic !== disabledModuleTopic && topic !== assignRolesTopic) {
      continue;
    }
    const parsed = parseRolesLog(log);
    if (!parsed) continue;
    const module = String(parsed.args.module).toLowerCase();
    if (topic === disabledModuleTopic) enabled.delete(module);
    else enabled.add(module);
  }
  return enabled;
};

export interface IStoredUnwrapAdapter {
  /** The contract whose batches are unpacked (MultiSend, usually). */
  to: string;
  selector: string;
  adapter: string;
}

const setUnwrapAdapterTopic = rolesInterface
  .getEvent("SetUnwrapAdapter")!
  .topicHash.toLowerCase();

/**
 * The batch unwrappers the modifier applies right now. A call to `to` with
 * `selector` is not checked as one call: the adapter splits it and every
 * inner call is checked on its own, for whichever role sends it. They belong
 * to the modifier, not to a role; setting the zero adapter removes one.
 */
export const storedUnwrapAdapters = (logs: IRoleScopeLog[]): IStoredUnwrapAdapter[] => {
  const adapters = new Map<string, IStoredUnwrapAdapter>();
  for (const log of inLogOrder(logs)) {
    if ((log.topics?.[0] ?? "").toLowerCase() !== setUnwrapAdapterTopic) continue;
    const parsed = parseRolesLog(log);
    if (!parsed) continue;
    const to = String(parsed.args.to);
    const selector = String(parsed.args.selector);
    const adapter = String(parsed.args.adapter);
    const key = `${to.toLowerCase()}:${selector.toLowerCase()}`;
    // Re-set, so an adapter changed later lists where it was changed.
    adapters.delete(key);
    if (BigInt(adapter) !== 0n) adapters.set(key, { to, selector, adapter });
  }
  return [...adapters.values()];
};

const setAllowanceTopic = rolesInterface.getEvent("SetAllowance")!.topicHash.toLowerCase();

/**
 * Every allowance key the modifier's owner has set, lowercase bytes32, in
 * the order each was first set. The modifier never deletes one; what is left
 * of it is read live (see accrueAllowance).
 */
export const storedAllowanceKeys = (logs: IRoleScopeLog[]): string[] => {
  const keys: string[] = [];
  for (const log of inLogOrder(logs)) {
    if ((log.topics?.[0] ?? "").toLowerCase() !== setAllowanceTopic) continue;
    const parsed = parseRolesLog(log);
    if (!parsed) continue;
    const key = String(parsed.args.allowanceKey).toLowerCase();
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
};

export interface IRolesAllowance {
  refill: bigint;
  maxRefill: bigint;
  period: bigint;
  balance: bigint;
  timestamp: bigint;
}

const UINT64_MAX = (1n << 64n) - 1n;
const UINT128_MAX = (1n << 128n) - 1n;

/**
 * An allowance's balance at `now` (unix seconds), refilled the way the
 * modifier refills it on its next use (AllowanceTracker._accruedAllowance in
 * Roles v2): whole periods elapsed since `timestamp` each add `refill`,
 * capped at `maxRefill`, and a balance already at or above the cap stays
 * where it is. A zero period never refills.
 *
 * null when the contract's checked arithmetic overflows on this allowance:
 * then every call that draws on it reverts, whatever the balance says.
 */
export const accrueAllowance = (allowance: IRolesAllowance, now: bigint): bigint | null => {
  const { refill, maxRefill, period, balance, timestamp } = allowance;
  if (period === 0n) return balance;
  if (timestamp + period > UINT64_MAX) return null;
  if (now < timestamp + period) return balance;
  if (balance >= maxRefill) return balance;
  const added = refill * ((now - timestamp) / period);
  if (added > UINT128_MAX || balance + added > UINT128_MAX) return null;
  return balance + added < maxRefill ? balance + added : maxRefill;
};
