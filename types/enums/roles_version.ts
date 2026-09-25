/**
 * Which generation of the Zodiac Roles modifier a vault's Safe runs.
 *
 * The two generations are different contracts with different ABIs: V1
 * identifies a role by `uint16` (scopeTarget(uint16,address), ...), V2 by
 * `bytes32` (scopeTarget(bytes32,address), ...). Calldata built for one is
 * not callable on the other — the selectors differ, and a V2 modifier has no
 * fallback, so a V1-encoded call simply reverts. Every place that encodes a
 * call to a modifier has to know which one it is talking to.
 *
 * Kept in types/ so both the encoders (types/enums, composables/nav) and the
 * execution layer (composables/permissions) can import it without a cycle.
 * The value is probed on chain (see detectRolesVersion in
 * composables/permissions/useRoleExecution.ts); the vault's factory version is
 * only a hint.
 */
export enum RolesVersion {
  V1 = "V1",
  V2 = "V2",
}

export const rolesVersionLabel = (version: RolesVersion | null | undefined) =>
  version === RolesVersion.V1
    ? "Roles v1"
    : version === RolesVersion.V2
      ? "Roles v2"
      : "Roles (version unknown)";
