import { ethers } from "ethers";
import RolesFullV1 from "~/assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import {
  DEFAULT_ROLE_KEY,
  DEFAULT_ROLE_KEY_V2,
} from "~/composables/nav/generateNAVPermission";
import { useAccountStore } from "~/store/account/account.store";
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
 * Raw eth_call against the chain's configured RPCs, from a spoofed sender.
 * Mirrors the fallback pattern in services/onchain/delegates.ts: try each
 * RPC until one answers, and treat an RPC-level revert as the answer.
 */
const ethCallFrom = async (
  chainId: ChainId,
  from: string,
  to: string,
  data: string,
): Promise<{ reverted: boolean; returnData: string }> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(chainId);
  let lastError: unknown;

  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ from, to, data }, "latest"],
        }),
      });
      const json = await response.json();
      if (json.error) {
        // Execution revert: the revert payload travels in error.data (some
        // RPCs nest it one level deeper).
        const revertData =
          typeof json.error.data === "string"
            ? json.error.data
            : json.error.data?.data ?? "";
        return { reverted: true, returnData: revertData };
      }
      return { reverted: false, returnData: json.result ?? "0x" };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No RPC available for chain ${chainId}`);
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
 * Send the wrapped call with the connected wallet. Callers are expected to
 * have simulated first; this returns the CustomContract PromiEvent so pages
 * keep their usual .on("transactionHash"/"receipt"/"error") flow.
 */
export const sendRoleExecution = (
  chainId: ChainId,
  rolesModAddress: string,
  call: IRoleCall,
  roleKey: string = DEFAULT_ROLE_KEY_V2,
  version: RolesVersion = RolesVersion.V2,
) => {
  const web3Store = useWeb3Store();
  const abi =
    version === RolesVersion.V1
      ? (RolesFullV1 as any).abi
      : (RolesFullV2 as any).abi;
  const rolesContract = web3Store.getCustomContract(chainId, abi, rolesModAddress);
  return rolesContract.send(
    "execTransactionWithRole",
    {},
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
 * The modifier's full AssignRoles history. The event is unindexed, so this
 * is a single unbounded eth_getLogs on the modifier — tiny log volume, same
 * RPC caveats as services/onchain/delegates.ts.
 */
const fetchAssignRolesLogs = async (
  chainId: ChainId,
  rolesModAddress: string,
  version: RolesVersion,
): Promise<any[]> => {
  const web3Store = useWeb3Store();
  const rpcUrls = web3Store.networkRpcUrls(chainId);
  const topic =
    version === RolesVersion.V1 ? ASSIGN_ROLES_TOPIC_V1 : ASSIGN_ROLES_TOPIC;
  let lastError: unknown;

  for (const rpcUrl of rpcUrls) {
    try {
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
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No RPC available for chain ${chainId}`);
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
