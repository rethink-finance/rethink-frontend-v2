import {
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_KEY_V2,
  toRoleKeyBytes32,
} from "~/composables/nav/generateNAVPermission";
import { RolesVersion } from "~/types/enums/roles_version";

/**
 * The default manager role id in the encoding fetchMemberRoles reports:
 * a decimal string on V1, bytes32 hex on V2.
 */
export const defaultRoleId = (version: RolesVersion) =>
  version === RolesVersion.V1
    ? String(Number(DEFAULT_ROLE_KEY))
    : toRoleKeyBytes32(DEFAULT_ROLE_KEY_V2);

/**
 * Which of the manager's roles a NAV / permission proposal should target.
 * The generation's default role wins when the manager holds it; otherwise
 * the single role they hold; with several and no default, the first as the
 * modifier's history lists it. `assumed` says the default was taken without
 * any membership to back it.
 */
export const pickManagerRole = (
  version: RolesVersion,
  managerRoles: string[],
): { role: string; assumed: boolean } => {
  const preferred = defaultRoleId(version);
  const held = managerRoles.map((r) => r.toLowerCase());
  if (held.includes(preferred.toLowerCase())) {
    return { role: preferred, assumed: false };
  }
  if (managerRoles.length) return { role: managerRoles[0], assumed: false };
  return { role: preferred, assumed: true };
};
