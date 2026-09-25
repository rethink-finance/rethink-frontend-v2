import { ethers } from "ethers";
import { defaultRoleId, pickManagerRole } from "~/composables/permissions/managerRole";
import {
  defaultRoleFor,
  detectRolesVersion,
  fetchDefaultRole,
  fetchMemberRoles,
  fetchRoleMembers,
  fetchRolesModifierOwner,
  fetchSafeControl,
  fetchSettingsGovernorAndSafe,
} from "~/composables/permissions/useRoleExecution";
import { useFundStore } from "~/store/fund/fund.store";
import type { ChainId } from "~/types/enums/chain_id";
import { RolesVersion, rolesVersionLabel } from "~/types/enums/roles_version";

export { pickManagerRole } from "~/composables/permissions/managerRole";

/**
 * Everything a governance proposal needs to know about the vault's Roles
 * modifier before it encodes a call to it, resolved from the chain in one
 * place:
 *
 * - which contract it is and which generation (V1 uint16 roles / V2 bytes32
 *   role keys) — probed on the modifier itself, never inferred from how the
 *   vault was created;
 * - who owns it — the governor until the one-time V2 activation hands it to
 *   the Safe, after which a governance proposal can no longer administer it;
 * - which role the vault's manager actually holds, so a permission is written
 *   for that role instead of the "1" / "defaulManagerRole" every vault starts
 *   with and some no longer use.
 */
export interface IRolesModifierProfile {
  chainId: ChainId;
  fundAddress: string;
  /** "" when the Safe has no Roles modifier (or is not a contract). */
  address: string;
  version: RolesVersion | null;
  label: string;
  /** Modifier owner, null when it could not be read. */
  owner: string | null;
  /** The governor administers the modifier, so a proposal may write to it. */
  governorOwned: boolean;
  /** The vault's Safe (settings.safe). */
  safe: string;
  /**
   * `settings.governor` is the Safe (a V2 vault after activation): the
   * vault's updateNav and the executor's storeNAVData reject the governor and
   * must be executed AS the Safe. See composables/governance/safeExecution.ts.
   */
  governorIsSafe: boolean;
  /**
   * The governor is a Safe owner with threshold 1, so a proposal action can be
   * `Safe.execTransaction(...)` with its pre-validated signature. Null when
   * the Safe could not be read.
   */
  safeControlledByGovernor: boolean | null;
  /** The modifier is owned by the Safe (activated), and the Safe by the governor. */
  safeOwnedAndControlled: boolean;
  /** Roles the vault's managers hold, ids as the modifier reports them. */
  managerRoles: string[];
  /** The role permissions are written for. */
  role: string;
  /**
   * `role` is the generation's default because no manager membership could
   * be established — the proposal will still encode, but the permission may
   * land on a role nobody holds.
   */
  roleAssumed: boolean;
  /**
   * Membership could not be READ (every source failed), as opposed to read
   * and found empty. On Base the AssignRoles log replay is refused by the
   * public RPCs, so this is what a healthy vault looks like there unless the
   * modifier's defaultRoles(manager) is set.
   */
  membershipUnknown: boolean;
}

const profileCache = new Map<string, IRolesModifierProfile>();
const inFlight = new Map<string, Promise<IRolesModifierProfile>>();

const cacheKey = (chainId: ChainId, fundAddress: string) =>
  `${chainId}:${fundAddress.toLowerCase()}`;

/** Forget the resolved profiles — after a role assignment or activation. */
export const clearRolesModifierProfileCache = () => profileCache.clear();

const readProfile = async (
  chainId: ChainId,
  fundAddress: string,
  governorAddress: string | undefined,
  managerAddresses: string[],
  versionHint: RolesVersion,
): Promise<IRolesModifierProfile> => {
  const fundStore = useFundStore();
  const address: string = (await fundStore.fetchRoleModAddress(fundAddress)) || "";
  const settings = await fetchSettingsGovernorAndSafe(chainId, fundAddress);
  const safe = settings?.safe ?? "";
  const governorIsSafe =
    !!settings && settings.governor.toLowerCase() === settings.safe.toLowerCase();
  const safeControlledByGovernor =
    safe && governorAddress ? await fetchSafeControl(chainId, safe, governorAddress) : null;
  if (!address) {
    return {
      chainId,
      fundAddress,
      address: "",
      version: null,
      label: "No Roles modifier",
      owner: null,
      governorOwned: false,
      safe,
      governorIsSafe,
      safeControlledByGovernor,
      safeOwnedAndControlled: false,
      managerRoles: [],
      role: "",
      roleAssumed: true,
      membershipUnknown: true,
    };
  }

  const version = await detectRolesVersion(chainId, address, versionHint);
  const owner = await fetchRolesModifierOwner(chainId, address);
  const ownerIsSafe = !!owner && !!safe && owner.toLowerCase() === safe.toLowerCase();

  // Two sources for the manager's roles, cheapest first: the modifier's own
  // defaultRoles(manager) (one eth_call, set on every Rethink vault at
  // creation), then the AssignRoles log replay for anything beyond it.
  const managerRoles: string[] = [];
  const addRole = (role: string) => {
    if (!managerRoles.some((r) => r.toLowerCase() === role.toLowerCase())) {
      managerRoles.push(role);
    }
  };
  let membershipUnknown = false;
  for (const manager of managerAddresses) {
    if (!ethers.isAddress(manager)) continue;
    const defaultRole = await fetchDefaultRole(chainId, address, manager, version);
    if (defaultRole) addRole(defaultRole);
    try {
      for (const role of await fetchMemberRoles(chainId, address, manager, version)) {
        addRole(role);
      }
    } catch (error) {
      console.warn(`Could not replay the roles of manager ${manager}`, error);
      if (!defaultRole) membershipUnknown = true;
    }
  }
  // V2 vaults pin settings.allowedManagers to [] (the manager is whoever
  // holds the role), so with no manager address to look up, establish the
  // default role the other way round: does anybody hold it?
  if (!managerRoles.length) {
    try {
      const holders = await fetchRoleMembers(chainId, address, defaultRoleFor(version), version);
      if (holders.length) addRole(defaultRoleId(version));
    } catch (error) {
      console.warn("Could not replay the default role's members", error);
      membershipUnknown = true;
    }
  }
  const { role, assumed } = pickManagerRole(version, managerRoles);

  return {
    chainId,
    fundAddress,
    address,
    version,
    label: `${rolesVersionLabel(version)} · ${address.slice(0, 6)}…${address.slice(-4)}`,
    owner,
    governorOwned:
      !!owner &&
      !!governorAddress &&
      owner.toLowerCase() === governorAddress.toLowerCase(),
    safe,
    governorIsSafe,
    safeControlledByGovernor,
    safeOwnedAndControlled: ownerIsSafe && safeControlledByGovernor === true,
    managerRoles,
    role,
    roleAssumed: assumed,
    membershipUnknown: assumed && membershipUnknown,
  };
};

/**
 * Resolve (and cache per vault) the modifier profile. `managerAddresses` are
 * the vault's allowed managers from its settings; `versionHint` is only used
 * when every RPC refuses the probe.
 */
export const resolveRolesModifierProfile = (
  chainId: ChainId,
  fundAddress: string,
  options: {
    governorAddress?: string;
    managerAddresses?: string[];
    versionHint?: RolesVersion;
    force?: boolean;
  } = {},
): Promise<IRolesModifierProfile> => {
  const key = cacheKey(chainId, fundAddress);
  if (!options.force) {
    const cached = profileCache.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = inFlight.get(key);
    if (pending) return pending;
  }
  const request = readProfile(
    chainId,
    fundAddress,
    options.governorAddress,
    options.managerAddresses ?? [],
    options.versionHint ?? RolesVersion.V2,
  )
    .then((profile) => {
      // Only a modifier we could actually see is a fact worth keeping.
      if (profile.address && profile.version) profileCache.set(key, profile);
      return profile;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
};

/**
 * The profile of the selected vault, for proposal pages: resolves when the
 * vault (and its async factory flag) lands, exposes it reactively, and can be
 * re-read on demand.
 */
export const useRolesModifierProfile = () => {
  const fundStore = useFundStore();
  const profile = ref<IRolesModifierProfile | null>(null);
  const isResolving = ref(false);
  const error = ref<string>("");

  const resolve = async (force = false) => {
    const fund = fundStore.fund;
    if (!fund?.address || !fund?.chainId) return;
    isResolving.value = true;
    error.value = "";
    try {
      profile.value = await resolveRolesModifierProfile(fund.chainId, fund.address, {
        governorAddress: fund.governorAddress,
        managerAddresses: fund.allowedManagerAddresses ?? [],
        versionHint: fund.fundFactoryContractV2Used
          ? RolesVersion.V2
          : RolesVersion.V1,
        force,
      });
    } catch (e: any) {
      console.error("Could not resolve the Roles modifier profile", e);
      error.value = e?.message ?? String(e);
    } finally {
      isResolving.value = false;
    }
  };

  /** Awaits an in-flight resolve, or runs one; for submit handlers. */
  const ensureProfile = async (): Promise<IRolesModifierProfile | null> => {
    if (!profile.value) await resolve();
    return profile.value;
  };

  watch(
    // fundFactoryContractV2Used arrives asynchronously after the fund; it is
    // only the probe's fallback, but re-running on it keeps the hint honest.
    () => [
      fundStore.fund?.chainId,
      fundStore.fund?.address,
      fundStore.fund?.fundFactoryContractV2Used,
    ],
    () => {
      resolve();
    },
    { immediate: true },
  );

  return { profile, isResolving, error, resolve, ensureProfile };
};
