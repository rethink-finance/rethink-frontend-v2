import { EXECUTOR_ROLE_KEY_V2 } from "~/composables/nav/generateNAVPermission";
import {
  type IProtocolPermissionsBuild,
  listProtocolScopesToRevoke,
} from "~/composables/permissions/protocolPermissions";
import {
  buildRevokeEntriesV2,
  decodeRolesV2Targets,
  targetsStillInUse,
} from "~/composables/permissions/revokePermissions";
import type { ICurrentRoleScopes } from "~/composables/permissions/roleScopeLogs";
import { prepopulatedScopeLabels } from "~/composables/permissions/vaultRoles";
import type { ChainId } from "~/types/enums/chain_id";

export interface IRoleBatchOptions {
  chainId: ChainId | string;
  /** The registry's compiled grants for the role's current selections. */
  protocolBuild: IProtocolPermissionsBuild;
  /** What the modifier grants the role right now. */
  current: ICurrentRoleScopes;
  fundAddress: string;
  baseToken: string;
  rolesModifier: string;
  /**
   * The role the batch is for, as its label or bytes32 key. The executor
   * (role 2) unless said otherwise.
   */
  roleKey?: string;
  /**
   * The protocols the card was asked about this visit (see
   * listProtocolScopesToRevoke). Grants saved for any other protocol are
   * not this save's to take back.
   */
  protocols?: string[];
}

/**
 * The scopes the role's own switches decide, which the protocol diff never
 * takes back: the base token is usually also a lending reserve, and the
 * executor's "Send funds" switch owns its transfer grant.
 */
const sparedScopes = (options: IRoleBatchOptions) =>
  prepopulatedScopeLabels(options.roleKey ?? EXECUTOR_ROLE_KEY_V2, options).map(
    ({ scope }) => scope,
  );

/** What a save with these selections takes back off the modifier. */
export const integrationScopesToRevoke = (options: IRoleBatchOptions) =>
  listProtocolScopesToRevoke(
    options.chainId,
    options.protocolBuild,
    options.current,
    sparedScopes(options),
    options.protocols,
  );

/**
 * One role's protocol share of the Permissions step's batch: what it may touch beyond
 * its prepopulated permissions.
 *
 * Saving is authoritative for the protocols on the card: an asset unticked
 * since an earlier save is taken back off the modifier. The diff runs
 * against what the modifier stores for the role right now (`current`) and
 * only ever reclaims scopes on addresses of the protocols it was asked
 * about, so it scales with what the vault granted rather than with the
 * catalog, and never touches what an earlier visit saved for something else.
 * The switches' own scopes are spared in both directions.
 */
export const buildRoleIntegrationCalls = (
  options: IRoleBatchOptions & {
    /**
     * Raw calldata that the same batch submits after these calls. Only read
     * for the targets it grants on, which must keep their clearance.
     */
    rawEntries: string[];
  },
): string[] => {
  const { protocolBuild, rawEntries, current } = options;
  const revokedScopes = integrationScopesToRevoke(options);

  return [
    // Revocations first, so an explicit grant later in the batch still wins.
    // A target keeps its clearance while anything else is granted on it:
    // what the switches stored, what this save grants, what is pasted raw.
    ...buildRevokeEntriesV2(
      revokedScopes,
      [
        ...targetsStillInUse(current.scopes, revokedScopes),
        ...protocolBuild.targetAddresses,
        ...decodeRolesV2Targets(rawEntries),
      ],
      options.roleKey ?? EXECUTOR_ROLE_KEY_V2,
    ),
    ...protocolBuild.entries,
  ];
};

/**
 * One role's protocol share with the raw entries after it: the batch of a
 * save that carries nothing else.
 */
export const buildIntegrationsBatch = (
  options: IRoleBatchOptions & {
    /** Raw calldata pasted on the card, submitted verbatim. */
    rawEntries: string[];
  },
): string[] => [
  // Registry grants before the raw entries, so a power user's explicit
  // calls keep the last word on anything both touch.
  ...buildRoleIntegrationCalls(options),
  // Already validated against the Roles V2 ABI by the input component.
  ...options.rawEntries,
];

/**
 * The Permissions page's one batch: every role's members, its prepopulated
 * permissions (the switches) and what it is granted beyond them.
 *
 * The order is what makes one transaction safe where there used to be two:
 *
 * 1. Each role's protocol revocations and registry grants. A revocation may
 *    clear a target's clearance (revokeTarget) when nothing stored still uses
 *    it; the switches' own grants below count as using it.
 * 2. The switches: function revokes, then grants. Coming after (1), a grant
 *    here re-opens its target whatever (1) cleared, and a switch that is off
 *    has the last word over a registry grant on the same function.
 * 3. Membership.
 * 4. The raw entries, verbatim: a power user's explicit calls keep the last
 *    word on anything they touch.
 */
export const buildPermissionsPageBatch = (options: {
  /** The switches' batch (buildPrepopulatedPermissionsBatch). */
  prepopulated: { revokes: string[]; grants: string[] };
  /** assignRoles calls for every role's queued membership changes. */
  memberEntries: string[];
  /** The roles whose protocol card was touched. */
  roles: IRoleBatchOptions[];
  rawEntries: string[];
}): string[] => {
  // What the same batch grants after a role's revocations: targets these
  // name must keep their clearance.
  const laterGrants = [...options.prepopulated.grants, ...options.rawEntries];
  return [
    ...options.roles.flatMap((role) =>
      buildRoleIntegrationCalls({ ...role, rawEntries: laterGrants }),
    ),
    ...options.prepopulated.revokes,
    ...options.prepopulated.grants,
    ...options.memberEntries,
    ...options.rawEntries,
  ];
};
