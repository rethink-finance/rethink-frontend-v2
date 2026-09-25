import { ethers } from "ethers";
import {
  DEFAULT_RETURN_FORMAT,
  Web3PromiEvent,
  type TransactionReceipt,
} from "web3";
import {
  RolesVersion,
  defaultRoleFor,
  detectRolesVersion,
  estimateRoleExecutionGas,
  fetchMemberRoles,
  sendRoleExecution,
  simulateDirectCall,
  simulateRoleExecution,
  type IRoleCall,
  type IRoleSimulationResult,
} from "~/composables/permissions/useRoleExecution";
import {
  EXECUTION_MODE_HINTS,
  resolveExecutionMode,
  type CuratorExecutionMode,
  EXECUTION_MODE_LABELS,
} from "~/composables/permissions/safeSession";
import type { IGasPlan } from "~/composables/permissions/gasLimit";
import { useAccountStore } from "~/store/account/account.store";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { ChainId } from "~/types/enums/chain_id";

/**
 * Curator execution for the vault's Safe-authority surfaces: NAV updates,
 * settlement, base-asset transfers, raw transactions, the execution consoles
 * and the curator pages (whitelist, profile, role members).
 *
 * Two kinds of session press these buttons, told apart by a single test —
 * is the connected account the vault's custody Safe?
 *
 * - Connected AS the Safe. That is what a Zodiac Pilot session looks like
 *   from inside the app (Pilot's provider reports the Safe as the account),
 *   and what Safe{Wallet} paired over WalletConnect looks like too. The call
 *   is sent unwrapped, from the Safe, exactly as this app did before curators
 *   could execute on their own: Pilot records it and replays the batch
 *   through the Roles modifier on submit. Wrapping it here would fail — the
 *   Safe holds no role on its own modifier — and would be pointless anyway,
 *   since the Safe already has the authority the wrapping exists to borrow.
 *
 * - Any other wallet is a curator only if it holds a role on the vault's
 *   modifier. Its call goes out as execTransactionWithRole against that
 *   modifier, under whichever of its roles a dry-run lets through.
 *
 * The plain functions carry the logic so store actions can use them;
 * useCuratorExecution() is the reactive wrapper components gate their
 * buttons on. They are split because the composable's watch must never run
 * inside a store action.
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

/**
 * A route a surface already knows. The execution consoles and the curator
 * pages address one specific modifier and role, so they hand it over rather
 * than have it resolved from the wallet's membership.
 */
export interface ICuratorRoute {
  chainId: ChainId;
  rolesModAddress: string;
  /** Defaults to the manager role of the modifier's generation. */
  role?: string;
  version?: RolesVersion;
}

/** Performs the send; see deferredSend for why it is a thunk. */
type SendThunk = () => Web3PromiEvent<any, any>;
type CuratorPromiEvent = Web3PromiEvent<TransactionReceipt, any>;

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
      await warnOfInnerRevert(chainId, call);
      return role;
    }
    if (!firstReason) firstReason = simulation.reason ?? "";
  }
  throw new Error(firstReason || "The Roles modifier denied this call.");
};

/**
 * Say why the wrapped call failed in simulation, in the target's own words.
 *
 * The modifier reports every inner failure as the same ModuleTransactionFailed,
 * so the reason has to be fetched separately: the same call, made directly
 * from the Safe, reverts with whatever the target actually said. The send
 * still goes ahead — see resolveExecutableRole — but a curator about to sign
 * something that simulates as failing should know it, and know why, before
 * the wallet opens rather than after the gas is spent.
 */
const warnOfInnerRevert = async (chainId: ChainId, call: IRoleCall) => {
  const safeAddress = useFundStore().fund?.safeAddress;
  let reason = "";
  if (safeAddress) {
    try {
      reason = (await simulateDirectCall(chainId, safeAddress, call)).reason ?? "";
    } catch (error) {
      console.warn("Could not read the inner revert reason", error);
    }
  }
  useToastStore().warningToast(
    "In simulation this call reverts when the Safe makes it" +
      (reason ? `. ${reason}` : ".") +
      " It will fail on chain unless a transaction still pending changes that.",
    15000,
  );
};

/**
 * A call that needs more than a standard block holds. On HyperEVM that is a
 * fact about the sender, not the transaction: big blocks (30M instead of 3M)
 * are an opt-in per address, and without it the transaction is never mined.
 */
const warnIfOversized = (chainId: ChainId, plan: IGasPlan | undefined) => {
  if (!plan?.exceedsBlockLimit) return;
  const needed = plan.gas.toLocaleString("en-US");
  useToastStore().warningToast(
    chainId === ChainId.HYPEREVM
      ? `This transaction needs about ${needed} gas, more than a standard ` +
          "HyperEVM block holds. It will only be mined if big blocks are " +
          "enabled for your wallet address."
      : `This transaction needs about ${needed} gas, more than a block on ` +
          "this network holds. It is unlikely to be mined.",
    20000,
  );
};

/**
 * The wrapped send, with the gas limit the app worked out for it. Wallets
 * size these calls badly (see gasLimit.ts), so the limit is stated instead
 * of left to them; when it cannot be estimated the wallet chooses, as before.
 */
const wrappedSend = async (
  chainId: ChainId,
  rolesModAddress: string,
  call: IRoleCall,
  role: string,
  version: RolesVersion,
): Promise<SendThunk> => {
  const plan = await estimateRoleExecutionGas(
    chainId,
    rolesModAddress,
    call,
    role,
    version,
  );
  warnIfOversized(chainId, plan);
  return () =>
    sendRoleExecution(chainId, rolesModAddress, call, role, version, plan?.gas);
};

/** Is the connected account the selected vault's custody Safe? */
export const isConnectedAsSafe = (): boolean =>
  useFundStore().isConnectedWalletTheSafe;

/**
 * A PromiEvent for a transaction that is only known after some async work:
 * which route to take, a network switch, a pre-flight.
 *
 * The emitter is handed back synchronously on purpose. A PromiEvent is a
 * thenable, so returning it from an `async` function would have that
 * function's promise adopt it — the caller's `await` would then yield the
 * mined receipt instead of the emitter, and every .on("transactionHash")
 * registered afterwards would sit on an object that has no .on at all. So
 * `prepare` resolves to a thunk that performs the send, and the send's
 * events are forwarded to the emitter once it exists, the way
 * CustomContract.send does it.
 *
 * Work that fails before a wallet prompt (no wallet, no membership, a denied
 * pre-flight, a refused network switch) rejects the promise without an
 * "error" event: that channel is for a transaction that went out.
 */
const deferredSend = (prepare: () => Promise<SendThunk>): CuratorPromiEvent => {
  const promiEvent: CuratorPromiEvent = new Web3PromiEvent((resolve, reject) => {
    prepare()
      .then((send) =>
        // Returned into the chain so the inner promise's rejection is
        // handled by the catch below rather than surfacing as unhandled.
        send()
          .on("transactionHash", (hash: any) =>
            promiEvent.emit("transactionHash", hash),
          )
          .on("receipt", (receipt: any) => {
            promiEvent.emit("receipt", receipt);
            resolve(receipt);
          })
          .on("error", (error: any) => {
            // Reject first: a listener that throws must not leave the
            // promise pending.
            reject(error);
            promiEvent.emit("error", error);
          }),
      )
      .catch(reject);
  });
  return promiEvent;
};

/**
 * Send `call` unwrapped, from the connected account — the Safe itself, on a
 * session isConnectedAsSafe() has vouched for.
 *
 * This mirrors what CustomContract.send did for these buttons before the
 * Roles route existed, because that is the path a Pilot session expects: the
 * wallet is moved to the vault's chain first (a Safe lives on one chain, so a
 * mismatch is reported instead of being sent to the wrong network), and the
 * wallet prices the transaction itself. Left to web3, the EIP-1559 autofill
 * opens with eth_getBlockByNumber, which the HyperEVM RPC refuses, and the
 * send would die before the wallet ever prompted.
 */
export const sendAsSafe = (chainId: ChainId, call: IRoleCall): CuratorPromiEvent =>
  deferredSend(async () => {
    const accountStore = useAccountStore();
    const account = accountStore.activeAccountAddress;
    if (!account) throw new Error("Connect your wallet first.");
    if (accountStore.connectedWalletChainId !== chainId) {
      await accountStore.switchNetwork(chainId);
    }
    const web3 = accountStore.connectedWalletWeb3;
    if (!web3) throw new Error("No wallet provider detected.");
    return () =>
      web3.eth.sendTransaction(
        {
          from: account,
          to: call.to,
          data: call.data,
          value: call.value ?? "0",
        },
        DEFAULT_RETURN_FORMAT,
        { checkRevertBeforeSending: false, ignoreGasPricing: true },
      );
  });

/**
 * Dry-run `call` the way it is about to go out: unwrapped from the Safe on a
 * Safe session, wrapped under `route`'s role otherwise. Surfaces that
 * pre-flight before opening the wallet use this, so a Pilot session is not
 * measured against a membership it does not have.
 */
export const simulateCuratorTransaction = async (
  call: IRoleCall,
  route: ICuratorRoute,
): Promise<IRoleSimulationResult> => {
  if (isConnectedAsSafe()) {
    const account = useAccountStore().activeAccountAddress;
    if (!account) return { ok: false, reason: "Connect your wallet first." };
    return await simulateDirectCall(route.chainId, account, call);
  }
  const version = route.version ?? RolesVersion.V2;
  return await simulateRoleExecution(
    route.chainId,
    route.rolesModAddress,
    call,
    route.role ?? defaultRoleFor(version),
    version,
  );
};

/**
 * Send `call` with the connected wallet: unwrapped when the wallet is the
 * Safe, otherwise wrapped in the vault's Roles modifier — under `route` when
 * the caller knows it, else under whichever role the wallet's membership
 * turns up. Returns a PromiEvent synchronously, so callers register their
 * .on("transactionHash" / "receipt" / "error") handlers on it directly and
 * await it for the receipt — never `await` the call itself (see
 * deferredSend).
 */
export const sendCuratorTransaction = (
  call: IRoleCall,
  route?: ICuratorRoute,
): CuratorPromiEvent =>
  deferredSend(async () => {
    const fundStore = useFundStore();
    const accountStore = useAccountStore();

    const account = accountStore.activeAccountAddress;
    if (!accountStore.isConnected || !account) {
      throw new Error("Connect your wallet first.");
    }

    const chainId =
      route?.chainId ??
      ((fundStore.fund?.chainId ?? fundStore.selectedFundChain) as ChainId);

    if (isConnectedAsSafe()) return () => sendAsSafe(chainId, call);

    if (route) {
      const version = route.version ?? RolesVersion.V2;
      return wrappedSend(
        chainId,
        route.rolesModAddress,
        call,
        route.role ?? defaultRoleFor(version),
        version,
      );
    }

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
    return wrappedSend(chainId, state.rolesModAddress, call, role, state.version);
  });

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

  /**
   * The connected wallet IS the custody Safe — a Zodiac Pilot session, or
   * Safe{Wallet} paired directly. Sends go out unwrapped, from the Safe, and
   * membership is never asked about.
   */
  const isConnectedAsSafe = computed(() => fundStore.isConnectedWalletTheSafe);

  /** A role confirmed from the modifier's own log — not assumed. */
  const isCurator = computed(
    () =>
      !!roleState.value &&
      !roleState.value.unknown &&
      roleState.value.roles.length > 0,
  );

  /** No source could serve the membership log; the dry-run decides. */
  const isUnverified = computed(() => !!roleState.value?.unknown);

  /** How a press would go out, for the surface to say so. */
  const executionMode = computed<CuratorExecutionMode>(() =>
    resolveExecutionMode(
      accountStore.isConnected,
      isConnectedAsSafe.value,
      isCurator.value,
      isUnverified.value,
    ),
  );

  /** The status pill's text; empty when nothing can execute. */
  const executionLabel = computed(() =>
    executionMode.value === "none"
      ? ""
      : EXECUTION_MODE_LABELS[executionMode.value],
  );

  /** May the connected wallet press the vault's execution buttons at all? */
  const canExecute = computed(() => executionMode.value !== "none");

  /** One line on what pressing does, for the enabled button's tooltip. */
  const executionHint = computed(() =>
    executionMode.value === "none"
      ? ""
      : EXECUTION_MODE_HINTS[executionMode.value],
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
    isUnverified,
    isConnectedAsSafe,
    executionMode,
    executionLabel,
    executionHint,
    canExecute,
    disabledReason,
    roleState,
    refresh,
    sendAsCurator: sendCuratorTransaction,
  };
};
