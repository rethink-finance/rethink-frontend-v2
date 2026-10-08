import { ethers } from "ethers";
import RolesFullV1 from "~/assets/contracts/zodiac/RolesFull.json";
import type { RolesQueryResponse } from "~/services/zodiac-subgraph/queries";
import {
  ConditionType,
  ParamComparison,
  ParameterType,
} from "~/types/enums/zodiac-roles";

/**
 * A Zodiac Roles v1 modifier's current permissions, rebuilt from its own
 * event log.
 *
 * Gnosis Guild retired every Roles v1 subgraph in September 2026: the airlock
 * gateway answers "subgraph not found: no allocations" on all chains, and the
 * Studio deployments the v1 app itself points at answer "deployment does not
 * exist". The modifier keeps its `roles` mapping internal with no getter, so
 * the only remaining read of "what does this role grant" is a replay of the
 * events the contract emits as it is configured — the same replay the
 * subgraph's mapping did, folded here in the browser instead.
 *
 * The fold follows the contract's storage semantics where the subgraph's
 * entity bookkeeping diverged from them:
 *  - scopeAllowFunction packs a fresh scope config, so wildcarding a function
 *    drops its parameter conditions (the subgraph kept them);
 *  - scopeParameter / scopeParameterAsOneOf clear the wildcard bit, so the
 *    function stops being wildcarded (the subgraph left the flag set);
 *  - scopeRevokeFunction zeroes the scope config, so the function's parameters
 *    go with it (the subgraph orphaned them, and a later re-scope of the same
 *    selector would have resurrected them).
 * Everything else matches both: a target never disappears (RevokeTarget only
 * drops its clearance), functions survive a target revoke, and membership is
 * last-write-wins.
 *
 * Output is the subgraph's `rolesModifier` response shape, ids included
 * (`<modifier>-ROLE-<n>-TARGET-<address>-FUNCTION-<sighash>`), so the mapper
 * in services/zodiac-subgraph formats both sources identically.
 */

/**
 * The permission events are declared in the Permissions library and emitted
 * from the modifier's address, which is why the Roles artifact's ABI omits
 * them. Signatures are those of the v1 subgraph manifest, verified by decoding
 * a live modifier's full log.
 */
const PERMISSIONS_LIBRARY_EVENTS = [
  "event AllowTarget(uint16 role, address targetAddress, uint8 options)",
  "event ScopeTarget(uint16 role, address targetAddress)",
  "event RevokeTarget(uint16 role, address targetAddress)",
  "event ScopeAllowFunction(uint16 role, address targetAddress, bytes4 selector, uint8 options, uint256 resultingScopeConfig)",
  "event ScopeFunction(uint16 role, address targetAddress, bytes4 functionSig, bool[] isParamScoped, uint8[] paramType, uint8[] paramComp, bytes[] compValue, uint8 options, uint256 resultingScopeConfig)",
  "event ScopeFunctionExecutionOptions(uint16 role, address targetAddress, bytes4 functionSig, uint8 options, uint256 resultingScopeConfig)",
  "event ScopeParameter(uint16 role, address targetAddress, bytes4 functionSig, uint256 index, uint8 paramType, uint8 paramComp, bytes compValue, uint256 resultingScopeConfig)",
  "event ScopeParameterAsOneOf(uint16 role, address targetAddress, bytes4 functionSig, uint256 index, uint8 paramType, bytes[] compValues, uint256 resultingScopeConfig)",
  "event ScopeRevokeFunction(uint16 role, address targetAddress, bytes4 selector, uint256 resultingScopeConfig)",
  "event UnscopeParameter(uint16 role, address targetAddress, bytes4 functionSig, uint256 index, uint256 resultingScopeConfig)",
];

const rolesV1ContractEvents = ((RolesFullV1 as any).abi as any[]).filter(
  (fragment) => fragment.type === "event",
);

/** Every event a v1 modifier emits: the contract's own plus the library's. */
export const rolesV1Interface = new ethers.Interface([
  ...rolesV1ContractEvents,
  ...PERMISSIONS_LIBRARY_EVENTS,
]);

const REPLAYED_EVENTS = [
  "RolesModSetup",
  "AssignRoles",
  "AllowTarget",
  "ScopeTarget",
  "RevokeTarget",
  "ScopeAllowFunction",
  "ScopeRevokeFunction",
  "ScopeFunction",
  "ScopeFunctionExecutionOptions",
  "ScopeParameter",
  "ScopeParameterAsOneOf",
  "UnscopeParameter",
] as const;

/** topic0 of every event the replay reads; anything else is skipped. */
export const rolesV1ReplayTopics = new Set(
  REPLAYED_EVENTS.map(
    (name) => rolesV1Interface.getEvent(name)!.topicHash.toLowerCase(),
  ),
);

// Index → label, in the contracts' enum order (Permissions.sol / Roles.sol).
// Clearance needs no table: each event that moves it names the level
// (AllowTarget → Target, ScopeTarget → Function, RevokeTarget → None).
const EXECUTION_OPTIONS = ["None", "Send", "DelegateCall", "Both"];
const PARAMETER_TYPES = [
  ParameterType.STATIC,
  ParameterType.DYNAMIC,
  ParameterType.DYNAMIC32,
];
const COMPARISONS = [
  ParamComparison.EQUAL_TO,
  ParamComparison.GREATER_THAN,
  ParamComparison.LESS_THAN,
  ParamComparison.ONE_OF,
];

/** The raw log fields the replay needs, however the log was fetched. */
export interface IRolesV1Log {
  topics: readonly string[];
  data: string;
  blockNumber: number;
  logIndex: number;
}

export type RolesV1Modifier = NonNullable<RolesQueryResponse["rolesModifier"]>;
type RoleResponse = RolesV1Modifier["roles"][number];
type TargetResponse = RoleResponse["targets"][number];
type FunctionResponse = TargetResponse["functions"][number];
type ParameterResponse = FunctionResponse["parameters"][number];

interface FunctionDraft {
  id: string;
  sighash: string;
  executionOptions: string;
  wildcarded: boolean;
  parameters: Map<number, ParameterResponse>;
}

interface TargetDraft {
  id: string;
  address: string;
  clearance: ConditionType;
  executionOptions: string;
  functions: Map<string, FunctionDraft>;
}

interface RoleDraft {
  id: string;
  name: string;
  targets: Map<string, TargetDraft>;
  /** address → is currently a member (last AssignRoles wins) */
  members: Map<string, boolean>;
}

const byId = <T extends { id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const label = (labels: string[], index: unknown): string =>
  labels[Number(index)] ?? labels[0];

/**
 * Fold a modifier's logs into its current permissions.
 *
 * Logs may arrive in any order and may include events the replay does not
 * read (proxy upgrades, ownership transfers, module enables); both are
 * handled. Returns null when none of the logs is a Roles v1 event at all —
 * the address is not a v1 modifier, or its history could not be read — as
 * distinct from a modifier that exists but grants nothing.
 */
export const reduceRolesV1Logs = (
  logs: IRolesV1Log[],
  rolesModAddress: string,
): RolesV1Modifier | null => {
  const modifierId = rolesModAddress.toLowerCase();
  const roles = new Map<string, RoleDraft>();
  let avatar = "";
  let sawRolesV1Event = false;

  const getRole = (roleIdInContract: unknown): RoleDraft => {
    const name = String(roleIdInContract);
    let role = roles.get(name);
    if (!role) {
      role = {
        id: `${modifierId}-ROLE-${name}`,
        name,
        targets: new Map(),
        members: new Map(),
      };
      roles.set(name, role);
    }
    return role;
  };
  const findTarget = (roleIdInContract: unknown, address: string) =>
    roles.get(String(roleIdInContract))?.targets.get(address.toLowerCase());
  const getTarget = (role: RoleDraft, address: string): TargetDraft => {
    const key = address.toLowerCase();
    let target = role.targets.get(key);
    if (!target) {
      target = {
        id: `${role.id}-TARGET-${key}`,
        address: key,
        clearance: ConditionType.BLOCKED,
        executionOptions: "None",
        functions: new Map(),
      };
      role.targets.set(key, target);
    }
    return target;
  };
  const getFunction = (target: TargetDraft, sighash: string): FunctionDraft => {
    const key = sighash.toLowerCase();
    let func = target.functions.get(key);
    if (!func) {
      func = {
        id: `${target.id}-FUNCTION-${key}`,
        sighash: key,
        executionOptions: "None",
        wildcarded: false,
        parameters: new Map(),
      };
      target.functions.set(key, func);
    }
    return func;
  };
  const setParameter = (
    func: FunctionDraft,
    index: unknown,
    type: unknown,
    comparison: ParamComparison,
    comparisonValue: string[],
  ) => {
    const position = Number(index);
    // The contract packs a fresh non-wildcarded config on any parameter scope.
    func.wildcarded = false;
    func.parameters.set(position, {
      index: position,
      type: label(PARAMETER_TYPES, type) as ParameterType,
      comparison,
      comparisonValue: comparisonValue.map((value) => String(value).toLowerCase()),
    });
  };

  const sorted = [...logs].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
  );

  for (const log of sorted) {
    const topic = (log.topics?.[0] ?? "").toLowerCase();
    if (!rolesV1ReplayTopics.has(topic)) continue;

    let parsed: ethers.LogDescription | null;
    try {
      parsed = rolesV1Interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
    } catch (error) {
      console.warn("Skipping an undecodable Roles v1 log", log, error);
      continue;
    }
    if (!parsed) continue;
    sawRolesV1Event = true;
    const { args } = parsed;

    switch (parsed.name) {
      case "RolesModSetup":
        // (initiator, owner, avatar, target)
        avatar = String(args[2]).toLowerCase();
        break;

      case "AssignRoles": {
        // (module, roles[], memberOf[])
        const member = String(args[0]).toLowerCase();
        const roleIds = args[1] as unknown[];
        const memberOf = args[2] as unknown[];
        roleIds.forEach((roleId, i) => {
          getRole(roleId).members.set(member, Boolean(memberOf[i]));
        });
        break;
      }

      case "AllowTarget": {
        const target = getTarget(getRole(args.role), args.targetAddress);
        target.clearance = ConditionType.WILDCARDED;
        target.executionOptions = label(EXECUTION_OPTIONS, args.options);
        break;
      }

      case "ScopeTarget": {
        const target = getTarget(getRole(args.role), args.targetAddress);
        target.clearance = ConditionType.SCOPED;
        target.executionOptions = "None";
        break;
      }

      case "RevokeTarget": {
        // Only the clearance goes; the target and its functions stay, and a
        // later scopeTarget brings the stored function grants back to life.
        const target = findTarget(args.role, args.targetAddress);
        if (target) {
          target.clearance = ConditionType.BLOCKED;
          target.executionOptions = "None";
        }
        break;
      }

      case "ScopeAllowFunction": {
        const func = getFunction(
          getTarget(getRole(args.role), args.targetAddress),
          args.selector,
        );
        func.wildcarded = true;
        func.executionOptions = label(EXECUTION_OPTIONS, args.options);
        func.parameters = new Map();
        break;
      }

      case "ScopeRevokeFunction": {
        findTarget(args.role, args.targetAddress)?.functions.delete(
          String(args.selector).toLowerCase(),
        );
        break;
      }

      case "ScopeFunction": {
        const func = getFunction(
          getTarget(getRole(args.role), args.targetAddress),
          args.functionSig,
        );
        func.wildcarded = false;
        func.executionOptions = label(EXECUTION_OPTIONS, args.options);
        func.parameters = new Map();
        const isParamScoped = args.isParamScoped as unknown[];
        isParamScoped.forEach((scoped, i) => {
          if (!scoped) return;
          setParameter(
            func,
            i,
            args.paramType[i],
            label(COMPARISONS, args.paramComp[i]) as ParamComparison,
            [args.compValue[i]],
          );
        });
        break;
      }

      case "ScopeFunctionExecutionOptions": {
        const func = getFunction(
          getTarget(getRole(args.role), args.targetAddress),
          args.functionSig,
        );
        func.executionOptions = label(EXECUTION_OPTIONS, args.options);
        break;
      }

      case "ScopeParameter": {
        const func = getFunction(
          getTarget(getRole(args.role), args.targetAddress),
          args.functionSig,
        );
        setParameter(
          func,
          args.index,
          args.paramType,
          label(COMPARISONS, args.paramComp) as ParamComparison,
          [args.compValue],
        );
        break;
      }

      case "ScopeParameterAsOneOf": {
        const func = getFunction(
          getTarget(getRole(args.role), args.targetAddress),
          args.functionSig,
        );
        setParameter(
          func,
          args.index,
          args.paramType,
          ParamComparison.ONE_OF,
          [...(args.compValues as string[])],
        );
        break;
      }

      case "UnscopeParameter": {
        findTarget(args.role, args.targetAddress)
          ?.functions.get(String(args.functionSig).toLowerCase())
          ?.parameters.delete(Number(args.index));
        break;
      }
    }
  }

  if (!sawRolesV1Event) return null;

  return {
    id: modifierId,
    address: modifierId,
    avatar,
    roles: [...roles.values()].sort(byId).map(
      (role): RoleResponse => ({
        id: role.id,
        name: role.name,
        targets: [...role.targets.values()].sort(byId).map(
          (target): TargetResponse => ({
            id: target.id,
            address: target.address,
            executionOptions: target.executionOptions,
            clearance: target.clearance,
            functions: [...target.functions.values()].sort(byId).map(
              (func): FunctionResponse => ({
                sighash: func.sighash,
                executionOptions: func.executionOptions,
                wildcarded: func.wildcarded,
                parameters: [...func.parameters.values()].sort(
                  (a, b) => a.index - b.index,
                ),
              }),
            ),
          }),
        ),
        members: [...role.members.entries()]
          .filter(([, isMember]) => isMember)
          .map(([address]) => ({
            id: `${modifierId}-MEMBER-${address}-${role.id}`,
            member: { id: `${modifierId}-MEMBER-${address}`, address },
          })),
      }),
    ),
  };
};
