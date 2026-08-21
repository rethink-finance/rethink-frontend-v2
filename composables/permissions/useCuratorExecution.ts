import { ethers } from "ethers";
import { DEFAULT_RETURN_FORMAT } from "web3";
import {
  RolesVersion,
  defaultRoleFor,
  detectRolesVersion,
  fetchMemberRoles,
  sendRoleExecution,
  simulateRoleExecution,
  type IRoleCall,
} from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Curator execution for the vault's Safe-authority surfaces (NAV update,
 * base-asset transfers, sweeps, raw transactions).
 *
 * These used to require the Zodiac Pilot extension, which only ever did two
 * things: record the calldata a page would have sent, and replay it through
 * the Roles modifier. The frontend already knows the calldata, so it can do
 * the wrapping itself — a wallet that holds ANY role on the vault's
 * modifier is a curator, and its transactions go out as
 * execTransactionWithRole against that modifier.
 *
 * A wallet connected AS the Safe (Pilot, or a Safe connected directly) is
 * still supported and keeps sending the call unwrapped: from the Safe's own
 * address there is no modifier to route through, and routing would fail
 * membership anyway.
 *
 * The plain functions below carry the logic so store actions can use them;
 * useCuratorExecution() is the reactive wrapper components gate their
 * buttons on.
 */

export interface ICuratorRoleState {
  rolesModAddress: string;
  version: RolesVersion;
  /** Every role the connected wallet holds, most-likely-usable first. */
  roles: string[];
  /**
   * The membership read failed (typically an RPC that refuses unbounded
   * eth_getLogs). Buttons stay enabled and the pre-flight simulation becomes
   * the gate — better than locking a real curator out over an RPC hiccup.
   */
  unknown: boolean;
}

const stateCache = new Map<string, ICuratorRoleState>();
// The settlement page mounts three consumers at once (page + transfer card +
// sweep card); without this they would each fire their own log scan.
const inFlight = new Map<string, Promise<ICuratorRoleState | null>>();

const cacheKey = (chainId: ChainId, fundAddress: string, account: string) =>
  `${chainId}:${fundAddress.toLowerCase()}:${account.toLowerCase()}`;

/**
 * Forget what every wallet holds — call after a role assignment changes so
 * the next read goes back to the modifier.
 */
export const clearCuratorRoleCache = () => stateCache.clear();

/** The role id as the modifier's own logs report it, for comparisons. */
const encodedRoleId = (version: RolesVersion, role: string) =>
  version === RolesVersion.V1
    ? String(Number(role))
    : ethers.encodeBytes32String(role);

/**
 * Which roles `account` holds on the vault's modifier, and which modifier
 * generation it is. Cached per (chain, vault, account); pass force to re-read
 * after a membership change.
 */
export const resolveCuratorRoleState = (
  chainId: ChainId,
  fundAddress: string,
  account: string,
  versionHint: RolesVersion = RolesVersion.V2,
  force = false,
): Promise<ICuratorRoleState | null> => {
  const key = cacheKey(chainId, fundAddress, account);
  if (!force) {
    const cached = stateCache.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const request = readCuratorRoleState(
    chainId,
    fundAddress,
    account,
    versionHint,
    key,
  ).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
};

const readCuratorRoleState = async (
  chainId: ChainId,
  fundAddress: string,
  account: string,
  versionHint: RolesVersion,
  key: string,
): Promise<ICuratorRoleState | null> => {
  const fundStore = useFundStore();
  const rolesModAddress = await fundStore.fetchRoleModAddress(fundAddress);
  if (!rolesModAddress) return null;

  // The vault's factory version is only a hint here: the modifier itself is
  // what we are about to encode a call for, so probe it directly.
  const version = await detectRolesVersion(chainId, rolesModAddress, versionHint);

  let roles: string[] = [];
  let unknown = false;
  try {
    roles = await fetchMemberRoles(chainId, rolesModAddress, account, version);
  } catch (error) {
    console.warn("Could not read Roles membership", error);
    unknown = true;
  }

  // Try the role Rethink vaults grant their manager first; it is the one
  // carrying the NAV / settlement permissions on every vault we create.
  const preferredId = encodedRoleId(version, defaultRoleFor(version));
  roles.sort((a, b) => (a === preferredId ? -1 : b === preferredId ? 1 : 0));

  const state: ICuratorRoleState = {
    rolesModAddress,
    version,
    // With the membership read unavailable, assume the manager role and let
    // the pre-flight simulation say whether it actually holds.
    roles: unknown && !roles.length ? [preferredId] : roles,
    unknown,
  };
  // Only a positive result is cached. A failed read is not a fact, and
  // caching "holds nothing" would leave a wallet that gets its role assigned
  // mid-session locked out of the buttons until a page reload.
  if (!unknown && state.roles.length) stateCache.set(key, state);
  return state;
};

/**
 * Dry-run `call` against every role the wallet holds and return the first
 * the modifier lets through. Throws with the modifier's own reason when none
 * does, so a permission denial never reaches a wallet prompt — that is the
 * whole point of the pre-flight, since a denial used to surface only as an
 * opaque revert after signing.
 *
 * An inner revert is NOT a denial: the permission passed and the wrapped
 * call is what failed. Those are let through, because eth_call sees only the
 * current state — a deposit staged behind an approve, or a HyperCore action,
 * routinely simulates as failing and then succeeds once mined.
 */
const resolveExecutableRole = async (
  chainId: ChainId,
  state: ICuratorRoleState,
  call: IRoleCall,
): Promise<string> => {
  if (!state.roles.length) {
    throw new Error(
      "The connected wallet holds no role on this vault's Roles modifier.",
    );
  }

  let firstReason = "";
  for (const role of state.roles) {
    const simulation = await simulateRoleExecution(
      chainId,
      state.rolesModAddress,
      call,
      role,
      state.version,
    );
    if (simulation.ok) return role;
    if (simulation.innerRevert) {
      console.warn(
        "Roles permission accepted the call but it reverted in simulation:",
        simulation.reason,
      );
      return role;
    }
    if (!firstReason) firstReason = simulation.reason ?? "";
  }
  throw new Error(firstReason || "The Roles modifier denied this call.");
};

/**
 * Send `call` with the connected wallet, wrapping it in the vault's Roles
 * modifier unless the wallet is the Safe itself. Returns the web3 PromiEvent
 * either way, so callers keep their usual
 * .on("transactionHash" / "receipt" / "error") flow.
 */
export const sendCuratorTransaction = async (call: IRoleCall): Promise<any> => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();

  const account = accountStore.activeAccountAddress;
  if (!accountStore.isConnected || !account) {
    throw new Error("Connect your wallet first.");
  }

  const safeAddress = fundStore.fund?.safeAddress;
  if (safeAddress && safeAddress.toLowerCase() === account.toLowerCase()) {
    const web3 = accountStore.connectedWalletWeb3;
    if (!web3) throw new Error("No wallet provider detected.");
    return web3.eth.sendTransaction(
      {
        from: account,
        to: call.to,
        data: call.data,
        value: call.value ?? "0",
      },
      DEFAULT_RETURN_FORMAT,
      { checkRevertBeforeSending: false },
    );
  }

  const chainId = (fundStore.fund?.chainId ??
    fundStore.selectedFundChain) as ChainId;
  const state = await resolveCuratorRoleState(
    chainId,
    fundStore.fundAddress,
    account,
    fundStore.fund?.fundFactoryContractV2Used
      ? RolesVersion.V2
      : RolesVersion.V1,
  );
  if (!state?.rolesModAddress) {
    throw new Error("This vault has no Roles modifier to execute through.");
  }

  const role = await resolveExecutableRole(chainId, state, call);
  return sendRoleExecution(
    chainId,
    state.rolesModAddress,
    call,
    role,
    state.version,
  );
};

/**
 * Reactive gate for the execution buttons: resolves the connected wallet's
 * curator standing for the selected vault and re-resolves when either
 * changes.
 */
export const useCuratorExecution = () => {
  const fundStore = useFundStore();
  const accountStore = useAccountStore();

  const isLoading = ref(false);
  const roleState = ref<ICuratorRoleState | null>(null);

  const chainId = computed(
    () => (fundStore.fund?.chainId ?? fundStore.selectedFundChain) as ChainId,
  );
  const fundAddress = computed(() => fundStore.fund?.address ?? "");
  const account = computed(() => accountStore.activeAccountAddress ?? "");
  // Reads as a hint for the version probe, and arrives asynchronously — it
  // has to be a watch dependency or the first resolve pins the wrong guess.
  const isFactoryV2 = computed(
    () => !!fundStore.fund?.fundFactoryContractV2Used,
  );

  /** Legacy path: the connected wallet IS the custody Safe (Zodiac Pilot). */
  const isConnectedAsSafe = computed(() => {
    const safeAddress = fundStore.fund?.safeAddress;
    if (!safeAddress || !account.value) return false;
    return safeAddress.toLowerCase() === account.value.toLowerCase();
  });

  const isCurator = computed(
    () =>
      !!roleState.value &&
      (roleState.value.roles.length > 0 || roleState.value.unknown),
  );

  /** May the connected wallet press the vault's execution buttons at all? */
  const canExecute = computed(
    () =>
      accountStore.isConnected && (isConnectedAsSafe.value || isCurator.value),
  );

  const disabledReason = computed(() => {
    if (!accountStore.isConnected) {
      return "Connect your wallet to execute vault transactions.";
    }
    if (isLoading.value) return "Checking your vault permissions…";
    if (!canExecute.value) {
      return "The connected wallet holds no role on this vault's Roles modifier.";
    }
    return "";
  });

  const refresh = async (force = false) => {
    if (!fundAddress.value || !account.value || isConnectedAsSafe.value) {
      roleState.value = null;
      return;
    }
    isLoading.value = true;
    try {
      roleState.value = await resolveCuratorRoleState(
        chainId.value,
        fundAddress.value,
        account.value,
        isFactoryV2.value ? RolesVersion.V2 : RolesVersion.V1,
        force,
      );
    } catch (error) {
      console.error("Failed resolving curator role state", error);
      roleState.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    [fundAddress, account, chainId, isConnectedAsSafe, isFactoryV2],
    () => refresh(),
    { immediate: true },
  );

  return {
    isLoading,
    isCurator,
    isConnectedAsSafe,
    canExecute,
    disabledReason,
    roleState,
    refresh,
    sendAsCurator: sendCuratorTransaction,
  };
};
