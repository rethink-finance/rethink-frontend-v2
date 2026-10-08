import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ADMIN_ROLE_KEY_V2,
  isExecutorRoleKey,
} from "~/composables/nav/generateNAVPermission";
import type { IRawPermissionCodeEntry } from "~/composables/permissions/parseRawPermissionCode";
import {
  describePermission,
  type IPermissionDescription,
} from "~/composables/proposal/describeProposalActions";

/**
 * Raw Roles modifier calldata, laid out so it can be read: every queued call
 * decoded, and the calls grouped by the contract they open — which is how
 * the question "what does this let the role do, and where?" is actually
 * asked. A pasted batch arrives as scopeTarget / allowFunction /
 * scopeFunction calls in whatever order they were exported; one contract's
 * rules are usually three or four of them, not next to each other.
 */

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

export interface IQueuedCall {
  /** Position in the queue, which is also its position in the batch. */
  index: number;
  /** The Roles function this call invokes (scopeTarget, allowFunction…). */
  name: string;
  description: IPermissionDescription;
}

export type QueueGroupKind = "target" | "members" | "allowances" | "modifier";

export interface IQueueGroup {
  key: string;
  kind: QueueGroupKind;
  /** The contract the group's calls are about, for a target group. */
  target?: string;
  /** The roles the group's calls name, as their keys read ("adminRole"). */
  roles: string[];
  calls: IQueuedCall[];
}

/** ethers decodes to positional Results; the describer reads fields by name. */
const toPlain = (value: any, param: ethers.ParamType): any => {
  if (param.baseType === "array") {
    return [...value].map((item) => toPlain(item, param.arrayChildren!));
  }
  if (param.baseType === "tuple") {
    return Object.fromEntries(
      (param.components ?? []).map((component, i) => [
        component.name,
        toPlain(value[i], component),
      ]),
    );
  }
  return value;
};

export const describeQueuedCalls = (
  entries: IRawPermissionCodeEntry[],
): IQueuedCall[] =>
  entries.map((entry, index) => {
    let parsed: ethers.TransactionDescription | null = null;
    try {
      parsed = rolesInterface.parseTransaction({ data: entry.data });
    } catch {
      parsed = null;
    }
    if (!parsed) {
      // The input component only queues calldata that decodes, so this is a
      // row for something queued by other means; show it rather than hide it.
      return {
        index,
        name: entry.label,
        description: { action: "other", tone: "neutral", functionName: entry.label },
      };
    }
    const decoded = Object.fromEntries(
      parsed.fragment.inputs.map((input, i) => [
        input.name,
        toPlain(parsed!.args[i], input),
      ]),
    );
    return {
      index,
      name: parsed.name,
      description: describePermission(parsed.name, decoded),
    };
  });

const MEMBER_ACTIONS = new Set(["assign-roles", "set-default-role"]);

/**
 * One group per contract, in the order each is first mentioned; membership
 * changes and allowances, which belong to no contract, get a group each, and
 * whatever else targets the modifier itself goes last.
 */
export const groupQueuedCalls = (calls: IQueuedCall[]): IQueueGroup[] => {
  const groups = new Map<string, IQueueGroup>();
  const groupFor = (key: string, kind: QueueGroupKind, target?: string) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, kind, target, roles: [], calls: [] };
      groups.set(key, group);
    }
    return group;
  };

  for (const call of calls) {
    const { description } = call;
    let group: IQueueGroup;
    if (description.target && ethers.isAddress(description.target)) {
      group = groupFor(
        `target:${description.target.toLowerCase()}`,
        "target",
        description.target,
      );
    } else if (MEMBER_ACTIONS.has(description.action)) {
      group = groupFor("members", "members");
    } else if (description.action === "set-allowance") {
      group = groupFor("allowances", "allowances");
    } else {
      group = groupFor("modifier", "modifier");
    }
    group.calls.push(call);
    const roles =
      description.memberships?.map((membership) => membership.role) ??
      (description.role ? [description.role] : []);
    for (const role of roles) {
      if (!group.roles.includes(role)) group.roles.push(role);
    }
  }

  const order: QueueGroupKind[] = ["target", "members", "allowances", "modifier"];
  return [...groups.values()].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
};

/** A role as the create flow names it; any other key is shown as it is. */
export const queuedRoleName = (role?: string): string => {
  if (isExecutorRoleKey(role)) return "Executor";
  if (role === ADMIN_ROLE_KEY_V2) return "Admin";
  return role ?? "?";
};

const SECONDS: [number, string][] = [
  [86400, "day"],
  [3600, "hour"],
  [60, "minute"],
];

/** A refill period in the largest unit that divides it evenly. */
export const formatAllowancePeriod = (seconds: string): string => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  for (const [size, unit] of SECONDS) {
    if (value % size === 0) {
      const count = value / size;
      return count === 1 ? unit : `${count} ${unit}s`;
    }
  }
  return `${value} seconds`;
};
