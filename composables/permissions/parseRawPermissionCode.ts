import { ethers } from "ethers";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  ADMIN_ROLE_KEY_V2,
  isExecutorRoleKey,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";

export interface IRawPermissionCodeEntry {
  data: string;
  label: string;
}

const rolesInterface = new ethers.Interface((RolesFullV2 as any).abi);

const describe = (parsed: ethers.TransactionDescription): string => {
  const parts: string[] = [parsed.name];
  // Most Roles admin functions lead with (bytes32 roleKey, address target).
  try {
    const [first, second] = parsed.args;
    if (typeof first === "string" && first.length === 66) {
      parts.push(ethers.decodeBytes32String(first));
    }
    if (typeof second === "string" && ethers.isAddress(second)) {
      parts.push(`${second.slice(0, 8)}…${second.slice(-4)}`);
    } else if (typeof first === "string" && ethers.isAddress(first)) {
      parts.push(`${first.slice(0, 8)}…${first.slice(-4)}`);
    }
  } catch {
    // roleKey not a clean UTF-8 string — keep just the function name
  }
  return parts.join(" · ");
};

/**
 * Parse pasted raw Roles V2 calldata — newline/whitespace/comma separated
 * hex strings, or a JSON array of hex strings. Every entry must decode
 * against the Roles V2 ABI; the first failure throws with a 1-based entry
 * index so the input component can surface it.
 */
export const parseRawPermissionCode = (
  raw: string,
): IRawPermissionCodeEntry[] => {
  const trimmed = raw.trim();
  let candidates: string[];
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Input is not valid JSON.");
    }
    if (
      !Array.isArray(parsed) ||
      parsed.some((x) => typeof x !== "string")
    ) {
      throw new Error("JSON input must be an array of hex strings.");
    }
    candidates = parsed;
  } else {
    candidates = trimmed.split(/[\s,]+/).filter(Boolean);
  }

  return candidates.map((candidate, i) => {
    const data = candidate.trim();
    if (!/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10 || data.length % 2) {
      throw new Error(`Entry ${i + 1} is not valid hex calldata.`);
    }
    let parsed: ethers.TransactionDescription | null = null;
    try {
      parsed = rolesInterface.parseTransaction({ data });
    } catch {
      parsed = null;
    }
    if (!parsed) {
      throw new Error(
        `Entry ${i + 1} does not decode against the Roles V2 ABI ` +
          `(selector ${data.slice(0, 10)}).`,
      );
    }
    return { data, label: describe(parsed) };
  });
};

// The calls that grant or take back a permission, each for the role that is
// its first argument. Membership (assignRoles, setDefaultRole) is never
// rewritten: who holds a role is set on the role's own card.
const PERMISSION_CALLS = new Set([
  "allowFunction",
  "allowTarget",
  "revokeFunction",
  "revokeTarget",
  "scopeFunction",
  "scopeTarget",
]);

const ADMIN_KEY_BYTES = toRoleKeyBytes32(ADMIN_ROLE_KEY_V2).toLowerCase();
const isBuiltInRoleKey = (key: string) =>
  isExecutorRoleKey(key) || key.toLowerCase() === ADMIN_KEY_BYTES;

/**
 * Raw calls pasted on a role's card are that role's permissions. Calldata
 * exported from another vault names a built-in role (the executor, under
 * either spelling of its key, or the admin) that may not be the one on
 * screen, or not even the key this vault's executor holds; those calls are
 * re-encoded for `roleKey`. A call naming a custom role keeps it.
 */
export const retargetBuiltInRoleCalls = (
  entries: IRawPermissionCodeEntry[],
  roleKey: string,
): IRawPermissionCodeEntry[] => {
  const target = toRoleKeyBytes32(roleKey).toLowerCase();
  return entries.map((entry) => {
    const parsed = rolesInterface.parseTransaction({ data: entry.data });
    if (!parsed || !PERMISSION_CALLS.has(parsed.name)) return entry;
    const [current, ...rest] = parsed.args.toArray(true);
    if (!isBuiltInRoleKey(current) || current.toLowerCase() === target) return entry;
    const data = rolesInterface.encodeFunctionData(parsed.fragment, [target, ...rest]);
    return { data, label: describe(rolesInterface.parseTransaction({ data })!) };
  });
};
