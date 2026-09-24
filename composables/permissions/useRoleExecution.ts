import { ethers } from "ethers";
import RolesFullV1 from "~/assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import {
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_KEY_V2,
} from "~/composables/nav/generateNAVPermission";
import {
  TX_GAS_CAPS,
  planGasLimit,
  type IGasPlan,
} from "~/composables/permissions/gasLimit";
import { useAccountStore } from "~/store/account/account.store";
import { fetchExplorerLogs } from "~/services/onchain/explorerLogs";
import { fetchBlockscoutRoleLogs } from "~/services/onchain/roleScopes";
import { useWeb3Store } from "~/store/web3/web3.store";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * Curator-mode execution through the vault's Roles modifier.
 *
 * Where the create flow WRITES permissions, this composable USES them: it
 * wraps a target call into execTransactionWithRole under the caller's role,
 * dry-runs it with eth_call from the connected wallet, and only then sends
 * it. The dry-run matters because a Roles denial happens before any wallet
 * prompt otherwise would — the user gets told which constraint bit them
 * instead of a generic revert after signing.
 *
 * Both modifier generations are supported, because the two differ in the
 * ABI of the very call we make: V1 identifies a role by `uint16`, V2 by
 * `bytes32`. Everything version-dependent is resolved from `RolesVersion`,
 * which is probed on chain (see detectRolesVersion) rather than guessed.
 */

export enum RolesVersion {
  V1 = "V1",
  V2 = "V2",
}

const rolesIfaceV1 = new ethers.Interface((RolesFullV1 as any).abi);
const rolesIface = new ethers.Interface((RolesFullV2 as any).abi);
const fundIface = new ethers.Interface(GovernableFund.abi as any);

const rolesInterface = (version: RolesVersion) =>
  version === RolesVersion.V1 ? rolesIfaceV1 : rolesIface;

/** The role every Rethink vault grants its manager, per modifier generation. */
export const defaultRoleFor = (version: RolesVersion) =>
  version === RolesVersion.V1 ? DEFAULT_ROLE_KEY : DEFAULT_ROLE_KEY_V2;

/**
 * A role id as this module passes it around: a decimal string on V1 ("1"),
 * and either a plain label ("defaulManagerRole") or an already-encoded
 * bytes32 on V2 — role ids read back off chain arrive pre-encoded.
 */
const roleArg = (version: RolesVersion, role: string): string | number => {
  if (version === RolesVersion.V1) return Number(role);
  return ethers.isHexString(role, 32) ? role : ethers.encodeBytes32String(role);
};

// Deployed Roles v2.1 revert selectors (verified against the live modifier,
// not derived from any SDK — see rolesV2Permissions.ts for the same rule on
// the encoding side).
const CONDITION_VIOLATION_SELECTOR = "0xd0a9bf58"; // ConditionViolation(uint8,bytes32)
const MODULE_TRANSACTION_FAILED_SELECTOR = "0xd27b44a9"; // ModuleTransactionFailed()
const NO_MEMBERSHIP_SELECTOR = "0xfd8e9f28"; // NoMembership()
const ERROR_STRING_SELECTOR = "0x08c379a0"; // Error(string)

// Status codes confirmed empirically against the deployed v2.1 checker.
// Do NOT extend this table from an SDK enum — orderings differ.
const CONDITION_STATUS_HINTS: Record<number, string> = {
  1: "Delegate calls are not allowed by this permission.",
  2: "This target address is not allowed for the manager role.",
  3: "This function is not allowed on this target for the manager role.",
  4: "Sending value is not allowed by this permission.",
  7: "A parameter does not match the value pinned by the permission.",
};

/**
 * Roles V1 reports the same failures as separate zero-argument custom
 * errors instead of one ConditionViolation carrying a status. Selectors are
 * derived from the signatures at load rather than pasted in: an error name
 * that turns out not to exist simply never matches and falls through to the
 * generic message, where a mistyped hex constant would mislabel a revert.
 */
const V1_ERROR_HINTS: Record<string, string> = Object.fromEntries(
  (
    [
      ["TargetAddressNotAllowed()", "This target address is not allowed for your role."],
      ["FunctionNotAllowed()", "This function is not allowed on this target for your role."],
      ["ParameterNotAllowed()", "A parameter does not match the value pinned by the permission."],
      ["ParameterNotOneOfAllowed()", "A parameter is not one of the values allowed by the permission."],
      ["ParameterLessThanAllowed()", "A parameter is below the minimum allowed by the permission."],
      ["ParameterGreaterThanAllowed()", "A parameter is above the maximum allowed by the permission."],
      ["SendNotAllowed()", "Sending value is not allowed by this permission."],
      ["DelegateCallNotAllowed()", "Delegate calls are not allowed by this permission."],
      ["FunctionSignatureTooShort()", "The calldata is too short to contain a function signature."],
      ["CalldataOutOfBounds()", "The calldata could not be decoded against the permission."],
    ] as [string, string][]
  ).map(([signature, hint]) => [ethers.id(signature).slice(0, 10), hint]),
);

export interface IRoleSimulationResult {
  ok: boolean;
  /** Permission layer passed but the wrapped call itself reverted. */
  innerRevert?: boolean;
  reason?: string;
}

export interface IRoleCall {
  to: string;
  data: string;
  value?: string;
}

const encodeExecWithRole = (
  call: IRoleCall,
  role: string,
  version: RolesVersion,
): string =>
  rolesInterface(version).encodeFunctionData("execTransactionWithRole", [
    call.to,
    call.value ?? "0",
    call.data,
    0, // Operation.Call — the manager permissions never allow delegatecall
    roleArg(version, role),
    true, // shouldRevert: surface inner failures instead of returning false
  ]);

/**
 * Is this JSON-RPC error the chain answering — the call reverted — or the
 * endpoint failing (a rate limit, a spent quota, a method it does not serve)?
 * Only the first is an answer. The second has to fall through to the next
 * RPC: read as a revert it arrives with no payload, the pre-flight reports
 * "the call reverted (no revert data)", and a curator whose transaction is
 * fine is refused over an exhausted API key.
 *
 * Returns the revert payload ("" for a bare revert), or undefined when the
 * error is the endpoint's.
 */
const revertPayload = (error: any): string | undefined => {
  const data =
    typeof error?.data === "string" ? error.data : error?.data?.data;
  if (typeof data === "string") return data;
  if (error?.code === 3 || /revert/i.test(error?.message ?? "")) return "";
  return undefined;
};

/**
 * One JSON-RPC request over the chain's configured RPCs. Mirrors the fallback
 * pattern in services/onchain/delegates.ts: try each RPC until one answers,
 * and treat an execution revert as the answer.
 */
const rpcRequest = async (
  chainId: ChainId,
  method: string,
  params: unknown[],
): Promise<{ result?: any; revertData?: string }> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(chainId);
  let lastError: unknown;

  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await response.json();
      if (!json.error) return { result: json.result };
      const revertData = revertPayload(json.error);
      if (revertData !== undefined) return { revertData };
      lastError = new Error(json.error.message ?? `${method} failed`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No RPC available for chain ${chainId}`);
};

/** Raw eth_call from a spoofed sender. */
const ethCallFrom = async (
  chainId: ChainId,
  from: string,
  to: string,
  data: string,
  value?: string,
): Promise<{ reverted: boolean; returnData: string }> => {
  // A zero value is simply left out, the way a wallet would send it.
  const callValue =
    value && BigInt(value) > 0n ? ethers.toQuantity(BigInt(value)) : undefined;
  const { result, revertData } = await rpcRequest(chainId, "eth_call", [
    { from, to, data, ...(callValue ? { value: callValue } : {}) },
    "latest",
  ]);
  if (revertData !== undefined) return { reverted: true, returnData: revertData };
  return { reverted: false, returnData: result ?? "0x" };
};

const describeRevert = (
  returnData: string,
  version: RolesVersion = RolesVersion.V2,
): IRoleSimulationResult => {
  const selector = returnData?.slice(0, 10) ?? "";

  if (version === RolesVersion.V1 && V1_ERROR_HINTS[selector]) {
    return { ok: false, reason: V1_ERROR_HINTS[selector] };
  }
  if (selector === ERROR_STRING_SELECTOR) {
    try {
      const [message] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["string"],
        "0x" + returnData.slice(10),
      );
      return { ok: false, reason: `The call reverted: ${message}` };
    } catch {
      /* fall through to the generic message */
    }
  }
  if (selector === CONDITION_VIOLATION_SELECTOR) {
    let status = -1;
    try {
      status = Number(
        ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint8", "bytes32"],
          "0x" + returnData.slice(10),
        )[0],
      );
    } catch {
      /* keep the generic message */
    }
    return {
      ok: false,
      reason:
        CONDITION_STATUS_HINTS[status] ??
        `The Roles modifier denied this call (status ${status}).`,
    };
  }
  if (selector === NO_MEMBERSHIP_SELECTOR) {
    return {
      ok: false,
      reason:
        "The connected wallet does not hold the manager role on this vault.",
    };
  }
  if (selector === MODULE_TRANSACTION_FAILED_SELECTOR) {
    // The permission itself PASSED — the wrapped call reverted inside the
    // Safe. For updateSettings/assignRoles this is what a not-yet-activated
    // permission looks like (see the activation card on the Permissions
    // page); the caller decides how to phrase that.
    return {
      ok: false,
      innerRevert: true,
      reason:
        "The permission allows this call, but it reverted on the target contract.",
    };
  }
  return {
    ok: false,
    reason: `The call reverted (${selector || "no revert data"}).`,
  };
};

export const simulateRoleExecution = async (
  chainId: ChainId,
  rolesModAddress: string,
  call: IRoleCall,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  version: RolesVersion = RolesVersion.V2,
): Promise<IRoleSimulationResult> => {
  const accountStore = useAccountStore();
  const from = accountStore.activeAccountAddress;
  if (!from) return { ok: false, reason: "Connect your wallet first." };

  const { reverted, returnData } = await ethCallFrom(
    chainId,
    from,
    rolesModAddress,
    encodeExecWithRole(call, roleKey, version),
  );
  if (!reverted) return { ok: true };
  return describeRevert(returnData, version);
};

/**
 * Dry-run `call` exactly as it would be sent from `from`, with no modifier in
 * between — the pre-flight for a session connected as the Safe itself (see
 * useCuratorExecution). A revert here is the target's own answer, which is
 * what an inner revert means on the wrapped path, so it is reported the same
 * way: callers keep phrasing it as the target refusing, not as a permission
 * denial, because on this path there is no permission to deny.
 */
export const simulateDirectCall = async (
  chainId: ChainId,
  from: string,
  call: IRoleCall,
): Promise<IRoleSimulationResult> => {
  const { reverted, returnData } = await ethCallFrom(
    chainId,
    from,
    call.to,
    call.data,
    call.value,
  );
  if (!reverted) return { ok: true };
  return { ok: false, innerRevert: true, reason: describeRevert(returnData).reason };
};

/**
 * The gas limit of an ordinary block. HyperEVM interleaves 30M "big" blocks,
 * about one in forty, with its 3M standard ones, and only a sender who has
 * opted in is ever routed to a big one — so the smaller of the last two
 * blocks is the limit that applies. Two big blocks are never adjacent.
 */
const standardBlockGasLimit = async (
  chainId: ChainId,
): Promise<number | undefined> => {
  try {
    const latest = (
      await rpcRequest(chainId, "eth_getBlockByNumber", ["latest", false])
    ).result;
    if (!latest?.gasLimit) return undefined;
    const limits = [Number(BigInt(latest.gasLimit))];
    const previous = (
      await rpcRequest(chainId, "eth_getBlockByNumber", [
        ethers.toQuantity(BigInt(latest.number) - 1n),
        false,
      ])
    ).result;
    if (previous?.gasLimit) limits.push(Number(BigInt(previous.gasLimit)));
    return Math.min(...limits);
  } catch (error) {
    console.warn("Could not read the block gas limit", error);
    return undefined;
  }
};

/**
 * What the wrapped call needs, asked of the app's own RPCs rather than left
 * to the wallet (see gasLimit.ts for why). Undefined when it cannot be
 * estimated — an inner revert the pre-flight let through on purpose, or no
 * RPC answering — and the wallet is then left to choose, as it always was.
 */
export const estimateRoleExecutionGas = async (
  chainId: ChainId,
  rolesModAddress: string,
  call: IRoleCall,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  version: RolesVersion = RolesVersion.V2,
): Promise<IGasPlan | undefined> => {
  const from = useAccountStore().activeAccountAddress;
  if (!from) return undefined;
  try {
    const { result, revertData } = await rpcRequest(chainId, "eth_estimateGas", [
      {
        from,
        to: rolesModAddress,
        data: encodeExecWithRole(call, roleKey, version),
        value: "0x0",
      },
    ]);
    if (revertData !== undefined || !result) return undefined;
    return planGasLimit(
      Number(BigInt(result)),
      await standardBlockGasLimit(chainId),
      TX_GAS_CAPS[chainId],
    );
  } catch (error) {
    console.warn("Could not estimate gas for the role execution", error);
    return undefined;
  }
};

/**
 * Send the wrapped call with the connected wallet. Callers are expected to
 * have simulated first; this returns the CustomContract PromiEvent so pages
 * keep their usual .on("transactionHash"/"receipt"/"error") flow. `gas` is
 * the explicit limit from estimateRoleExecutionGas; without it the wallet
 * picks its own.
 */
export const sendRoleExecution = (
  chainId: ChainId,
  rolesModAddress: string,
  call: IRoleCall,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  version: RolesVersion = RolesVersion.V2,
  gas?: number,
) => {
  const web3Store = useWeb3Store();
  const abi =
    version === RolesVersion.V1
      ? (RolesFullV1 as any).abi
      : (RolesFullV2 as any).abi;
  const rolesContract = web3Store.getCustomContract(chainId, abi, rolesModAddress);
  return rolesContract.send(
    "execTransactionWithRole",
    gas ? { gas: String(gas) } : {},
    call.to,
    call.value ?? "0",
    call.data,
    0,
    roleArg(version, roleKey),
    true,
  );
};

/**
 * Which modifier generation is deployed behind `rolesModAddress`, probed on
 * chain instead of inferred from the vault's factory version — the factory
 * flag arrives asynchronously and only describes how the vault was created,
 * while this is a property of the contract we are about to encode a call
 * for. `multisend()` is a V1-only public getter: on a V2 modifier (which
 * has no fallback function) the call reverts.
 */
const rolesVersionCache = new Map<string, RolesVersion>();
const MULTISEND_SELECTOR = rolesIfaceV1.getFunction("multisend")!.selector;

export const detectRolesVersion = async (
  chainId: ChainId,
  rolesModAddress: string,
  fallback: RolesVersion = RolesVersion.V2,
): Promise<RolesVersion> => {
  const cacheKey = `${chainId}:${rolesModAddress.toLowerCase()}`;
  const cached = rolesVersionCache.get(cacheKey);
  if (cached) return cached;

  try {
    const { reverted, returnData } = await ethCallFrom(
      chainId,
      ethers.ZeroAddress,
      rolesModAddress,
      MULTISEND_SELECTOR,
    );
    const version =
      !reverted && (returnData?.length ?? 0) >= 66
        ? RolesVersion.V1
        : RolesVersion.V2;
    rolesVersionCache.set(cacheKey, version);
    return version;
  } catch (error) {
    // Every RPC refused — don't cache a guess, just answer this once.
    console.warn("Roles version probe failed, falling back", error);
    return fallback;
  }
};

/**
 * The live values updateSettings must echo. Read fresh from the fund right
 * before building calldata — never from cached frontend state — because the
 * Roles permission pins these values EXACTLY: an echo built from a stale
 * cache doesn't fail loudly, it fails as an opaque permission denial.
 */
export interface ILiveFundSettingsState {
  settings: Record<string, any>;
  fundMetadata: string;
  feePerformancePeriod: string;
  feeManagePeriod: string;
}

/**
 * Just the metadata JSON, in one call rather than the four
 * fetchLiveFundSettingsState makes.
 *
 * For rendering only. Anything building updateSettings calldata still needs the
 * full live state — and re-reads it at submit time regardless, since a struct
 * fetched when a form was opened is exactly the stale echo the pinning above
 * rejects.
 */
export const fetchLiveFundMetadata = async (
  chainId: ChainId,
  fundAddress: string,
): Promise<string> => {
  const web3Store = useWeb3Store();
  const fundContract = web3Store.getCustomContract(
    chainId,
    GovernableFund.abi as any,
    fundAddress,
  );
  return (await web3Store.callWithRetry(chainId, () =>
    fundContract.methods.fundMetadata().call(),
  )) as string;
};

export const fetchLiveFundSettingsState = async (
  chainId: ChainId,
  fundAddress: string,
): Promise<ILiveFundSettingsState> => {
  const web3Store = useWeb3Store();
  const fundContract = web3Store.getCustomContract(
    chainId,
    GovernableFund.abi as any,
    fundAddress,
  );
  const [settings, fundMetadata, feePerformancePeriod, feeManagePeriod] =
    await Promise.all([
      web3Store.callWithRetry(chainId, () =>
        fundContract.methods.getFundSettings().call(),
      ) as Promise<Record<string, any>>,
      web3Store.callWithRetry(chainId, () =>
        fundContract.methods.fundMetadata().call(),
      ) as Promise<string>,
      web3Store.callWithRetry(chainId, () =>
        fundContract.methods.feePerformancePeriod().call(),
      ),
      web3Store.callWithRetry(chainId, () =>
        fundContract.methods.feeManagePeriod().call(),
      ),
    ]);
  if (!settings?.safe || settings.safe === ethers.ZeroAddress) {
    throw new Error(
      "Fund settings are not initialized yet — finalize the vault first.",
    );
  }
  return {
    settings,
    fundMetadata,
    feePerformancePeriod: String(feePerformancePeriod),
    feeManagePeriod: String(feeManagePeriod),
  };
};

/**
 * updateSettings calldata for the curator-editable surfaces the Roles
 * permission leaves open: the depositor whitelist — its enforcement flag and
 * its addresses (XOR-toggle deltas) — and the metadata JSON. Everything else
 * echoes the live struct verbatim, with two deliberate exceptions the
 * permission demands:
 *
 * - governor is sent as the SAFE address (the permission pins it there; the
 *   fund's own governor check only passes once activation has run).
 * - allowedManagers is always [] (pinned empty — and, being an XOR delta,
 *   anything else would toggle live entries).
 *
 * Omitting isWhitelistedDeposits echoes the live flag, so a caller that only
 * edits addresses never races a concurrent flip.
 */
export const buildCuratorUpdateSettingsCalldata = (
  live: ILiveFundSettingsState,
  changes: {
    whitelistDeltas?: string[];
    isWhitelistedDeposits?: boolean;
    fundMetadata?: string;
  },
): string => {
  const settings = live.settings;
  const echoedSettings = {
    depositFee: settings.depositFee,
    withdrawFee: settings.withdrawFee,
    performanceFee: settings.performanceFee,
    managementFee: settings.managementFee,
    performaceHurdleRateBps: settings.performaceHurdleRateBps,
    baseToken: settings.baseToken,
    safe: settings.safe,
    isExternalGovTokenInUse: settings.isExternalGovTokenInUse,
    isWhitelistedDeposits:
      changes.isWhitelistedDeposits ?? settings.isWhitelistedDeposits,
    // XOR-toggle deltas: ONLY the addresses whose state should flip.
    allowedDepositAddrs: changes.whitelistDeltas ?? [],
    allowedManagers: [] as string[],
    governanceToken: settings.governanceToken,
    fundAddress: settings.fundAddress,
    governor: settings.safe,
    fundName: settings.fundName,
    fundSymbol: settings.fundSymbol,
    feeCollectors: settings.feeCollectors,
  };
  return fundIface.encodeFunctionData("updateSettings", [
    Object.values(echoedSettings),
    changes.fundMetadata ?? live.fundMetadata,
    live.feePerformancePeriod,
    live.feeManagePeriod,
  ]);
};

// keccak256 topic of AssignRoles — the role array type differs per
// generation, so the two events hash differently. V2's is the constant that
// was verified against the live modifier; V1's is derived from its ABI.
const ASSIGN_ROLES_TOPIC =
  "0x9f8368fa4ddcbd561efd7ad2a2174235bf5b840a73fb18f20db9705c11462498";
const ASSIGN_ROLES_TOPIC_V1 = rolesIfaceV1.getEvent("AssignRoles")!.topicHash;

/**
 * The modifier's full AssignRoles history, from the first source that can
 * serve it whole: the block explorer (topic-filtered, unbounded), then
 * Blockscout (no key, and it covers Base, whose public RPCs all cap the
 * eth_getLogs range), then each configured RPC.
 *
 * An RPC that answers [] is not believed on its own: a range-capped node says
 * [] for history it cannot see, and taking that at face value once told a
 * vault's real manager he held no role while telling strangers the read had
 * failed. "No assignments" is only the answer once every source that answered
 * agrees; when nothing answers at all this throws, and the caller treats the
 * membership as unknown rather than as absent.
 */
const fetchAssignRolesLogs = async (
  chainId: ChainId,
  rolesModAddress: string,
  version: RolesVersion,
): Promise<{ topics: string[]; data: string }[]> => {
  const web3Store = useWeb3Store();
  const topic = (
    version === RolesVersion.V1 ? ASSIGN_ROLES_TOPIC_V1 : ASSIGN_ROLES_TOPIC
  ).toLowerCase();
  const modifier = rolesModAddress.toLowerCase();

  // Every source hands back a slightly different shape; keep only what
  // parseLog needs, and only this modifier's AssignRoles.
  const onlyAssignRoles = (logs: any[]) =>
    logs
      .filter(
        (log) =>
          String(log?.topics?.[0] ?? "").toLowerCase() === topic &&
          (!log?.address || String(log.address).toLowerCase() === modifier),
      )
      .map((log) => ({
        topics: (log.topics ?? []).filter(Boolean).map(String),
        data: String(log.data ?? "0x"),
      }));

  const sources: (() => Promise<any[]>)[] = [
    () => fetchExplorerLogs(chainId, rolesModAddress, topic),
    () => fetchBlockscoutRoleLogs(chainId, rolesModAddress),
    ...web3Store.networkRpcUrls(chainId).map((rpcUrl: string) => async () => {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getLogs",
          params: [
            {
              address: rolesModAddress,
              topics: [topic],
              fromBlock: "0x0",
              toBlock: "latest",
            },
          ],
        }),
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      return json.result ?? [];
    }),
  ];

  let answeredEmpty = false;
  let lastError: unknown;
  for (const source of sources) {
    let logs: { topics: string[]; data: string }[];
    try {
      logs = onlyAssignRoles(await source());
    } catch (error) {
      lastError = error;
      continue;
    }
    if (!logs.length) {
      answeredEmpty = true;
      continue;
    }
    return logs;
  }
  if (answeredEmpty) return [];
  throw (
    lastError ??
    new Error(
      `No source could read the AssignRoles history of ${rolesModAddress} on chain ${chainId}`,
    )
  );
};

/**
 * Role id as a stable string key. Both generations stringify unambiguously:
 * V1's uint16 comes back as a bigint ("1"), V2's bytes32 as lowercase hex —
 * matching what roleArg() produces for the same role.
 */
const roleIdKey = (roleId: any): string => String(roleId);

/**
 * Current members of a role, reconstructed by replaying the modifier's
 * AssignRoles history — the last assignment per member wins.
 */
export const fetchRoleMembers = async (
  chainId: ChainId,
  rolesModAddress: string,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  version: RolesVersion = RolesVersion.V2,
): Promise<string[]> => {
  const logs = await fetchAssignRolesLogs(chainId, rolesModAddress, version);
  const wanted = String(roleArg(version, roleKey));

  const members = new Map<string, boolean>();
  for (const log of logs) {
    const parsed = rolesInterface(version).parseLog({
      topics: log.topics,
      data: log.data,
    });
    if (!parsed) continue;
    const [module, roleKeys, memberOf] = parsed.args;
    for (let i = 0; i < roleKeys.length; i++) {
      if (roleIdKey(roleKeys[i]) !== wanted) continue;
      members.set(ethers.getAddress(module), Boolean(memberOf[i]));
    }
  }
  return [...members.entries()]
    .filter(([, isMember]) => isMember)
    .map(([address]) => address);
};

/**
 * Every role `member` currently holds on this modifier — the inverse view of
 * fetchRoleMembers, and the check that decides whether a connected wallet is
 * a curator at all. Holding ANY role is what makes an address one; which
 * role actually permits a given call is settled by simulating against each.
 *
 * Returned ids are ready to hand back to simulate/sendRoleExecution: bytes32
 * hex on V2, decimal strings on V1.
 */
export const fetchMemberRoles = async (
  chainId: ChainId,
  rolesModAddress: string,
  member: string,
  version: RolesVersion = RolesVersion.V2,
): Promise<string[]> => {
  const logs = await fetchAssignRolesLogs(chainId, rolesModAddress, version);
  const wantedMember = member.toLowerCase();

  // Replay in order; the last assignment per (member, role) pair wins.
  const held = new Map<string, boolean>();
  for (const log of logs) {
    const parsed = rolesInterface(version).parseLog({
      topics: log.topics,
      data: log.data,
    });
    if (!parsed) continue;
    const [module, roleKeys, memberOf] = parsed.args;
    if (String(module).toLowerCase() !== wantedMember) continue;
    for (let i = 0; i < roleKeys.length; i++) {
      held.set(roleIdKey(roleKeys[i]), Boolean(memberOf[i]));
    }
  }
  return [...held.entries()]
    .filter(([, isMember]) => isMember)
    .map(([roleId]) => roleId);
};

/** assignRoles calldata for one membership change, targeting the modifier. */
export const buildAssignRolesCalldata = (
  memberAddress: string,
  isMember: boolean,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
): string =>
  rolesIface.encodeFunctionData("assignRoles", [
    memberAddress,
    [ethers.encodeBytes32String(roleKey)],
    [isMember],
  ]);
