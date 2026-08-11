import { ethers } from "ethers";
import { encodeFunctionCall } from "web3-eth-abi";
import ZodiacRoles from "~/assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import {
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_KEY_V2,
} from "~/composables/nav/generateNAVPermission";

/**
 * Taking prepopulated permissions back off the Roles modifier.
 *
 * Saving permissions is authoritative: a toggle that is off means the
 * modifier must not grant that call. Omitting it from the batch is only
 * enough on a vault that never saved before — after any earlier save the
 * grant is already stored, and leaving it out silently keeps it.
 *
 * Both revoke functions are plain storage deletes with no existence check
 * (v1 ScopeRevokeFunction / v2 PermissionBuilder.revokeFunction), so
 * revoking something that was never granted is a no-op rather than a
 * revert. That is what lets this run unconditionally on every save without
 * first reading modifier state — which is just as well, since Roles v2
 * keeps its `roles` mapping internal and exposes no getter for it.
 */

export interface IPermissionScope {
  /** Contract the permission points at. */
  target: string;
  /** 4-byte selector allowed on that target. */
  selector: string;
}

const findFunctionAbi = (abi: any[], name: string) => {
  const fragment = abi.find(
    (item: any) => item?.type === "function" && item?.name === name,
  );
  if (!fragment) throw new Error(`Roles ABI is missing ${name}`);
  return fragment;
};

const revokeFunctionAbiV2 = findFunctionAbi(
  (RolesFullV2 as any).abi,
  "revokeFunction",
);
const revokeTargetAbiV2 = findFunctionAbi(
  (RolesFullV2 as any).abi,
  "revokeTarget",
);
const scopeRevokeFunctionAbiV1 = findFunctionAbi(
  (ZodiacRoles as any).abi,
  "scopeRevokeFunction",
);

const rolesInterfaceV2 = new ethers.Interface((RolesFullV2 as any).abi);

/**
 * The Roles v2 admin calls that address a single target: every one of them
 * leads with (bytes32 roleKey, address target). Read off the ABI so a
 * mastercopy that adds another such function is covered without an edit
 * here.
 */
const targetScopedFunctionNamesV2 = new Set<string>(
  (RolesFullV2 as any).abi
    .filter(
      (item: any) =>
        item?.type === "function" &&
        item.inputs?.[0]?.type === "bytes32" &&
        item.inputs?.[1]?.type === "address",
    )
    .map((item: any) => item.name),
);

/**
 * Target addresses referenced by already-encoded Roles V2 admin calldata —
 * used to spare a target that something else in the same batch still needs.
 */
export const decodeRolesV2Targets = (encodedCalls: string[]): string[] => {
  const targets: string[] = [];
  for (const data of encodedCalls) {
    try {
      const parsed = rolesInterfaceV2.parseTransaction({ data });
      if (!parsed || !targetScopedFunctionNamesV2.has(parsed.name)) continue;
      targets.push(ethers.getAddress(parsed.args[1]));
    } catch {
      // Not a Roles V2 admin call we recognise; it cannot be vouching for a
      // target either, so skip it.
    }
  }
  return targets;
};

const dedupeScopes = (scopes: IPermissionScope[]): IPermissionScope[] => {
  const seen = new Set<string>();
  return scopes.filter(({ target, selector }) => {
    const key = `${target.toLowerCase()}:${selector.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Roles V2 revocations for permissions the curator switched off.
 *
 * `retainedTargets` are the targets the same batch still grants something
 * on. A target is only cleared when nothing retains it: revokeTarget works
 * per target, not per function, so clearing a shared one (the vault address
 * carries NAV, fees and settings) would take the surviving permissions with
 * it. Where a target survives, revokeFunction alone is already a full
 * revocation — a scoped target with no scoped functions allows nothing;
 * the target entry is cleared only so it stops showing up as an empty row
 * in the Roles UI.
 */
export const buildRevokeEntriesV2 = (
  revoked: IPermissionScope[],
  retainedTargets: string[],
  roleKey: string = DEFAULT_ROLE_KEY_V2,
): string[] => {
  const scopes = dedupeScopes(revoked);
  if (!scopes.length) return [];

  const roleKeyBytes = ethers.encodeBytes32String(roleKey);
  const entries = scopes.map(({ target, selector }) =>
    encodeFunctionCall(revokeFunctionAbiV2, [roleKeyBytes, target, selector]),
  );

  const retained = new Set(
    retainedTargets.filter(Boolean).map((target) => target.toLowerCase()),
  );
  const revokedTargets = new Map(
    scopes.map(({ target }) => [target.toLowerCase(), target]),
  );
  for (const [lowercased, target] of revokedTargets) {
    if (retained.has(lowercased)) continue;
    entries.push(encodeFunctionCall(revokeTargetAbiV2, [roleKeyBytes, target]));
  }
  return entries;
};

/**
 * Roles V1 revocations. Function-level only: on V1 the same modifier is
 * edited by the role editor on this step, which owns target clearance and
 * submits its own calls in the same batch — a revokeTarget from here could
 * drop what the editor just scoped.
 */
export const buildRevokeEntriesV1 = (
  revoked: IPermissionScope[],
  roleId: string = DEFAULT_ROLE_KEY,
): string[] =>
  dedupeScopes(revoked).map(({ target, selector }) =>
    encodeFunctionCall(scopeRevokeFunctionAbiV1, [roleId, target, selector]),
  );
