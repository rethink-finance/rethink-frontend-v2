import { ethers } from "ethers";
import type { AtomicBatchStatus, WalletBatchCall } from "~/services/eip5792";

/**
 * The calls behind the create flow's last button: finalizeCreateFund on the
 * factory, followed by the vault's first NAV update.
 *
 * Why the two belong in one transaction: until a vault has recorded its first
 * NAV update, a deposit request settles immediately — no curator in between.
 * Finalizing alone therefore opens a window in which anyone can deposit,
 * delegate to themselves and hold the whole voting supply (and, at zero
 * supply, a claim on whatever already sits in the Safe). The first NAV update
 * closes it: from then on a request waits for the next update. Verified on a
 * Polygon fork — finalize alone let 1 token mint 100% of supply; with the NAV
 * update in the same transaction the instant deposit reverts.
 *
 * The factory has no hook for this (finalizeCreateFund takes no arguments and
 * the NAV update is Safe authority), so the merge happens in the wallet: an
 * EIP-5792 atomic batch from the deployer, whose second call goes through the
 * vault's Roles modifier under a role the deployer already holds.
 *
 * Kept free of stores so the encoding is unit-testable.
 */

const FACTORY_INTERFACE = new ethers.Interface([
  "function finalizeCreateFund()",
]);
const FUND_INTERFACE = new ethers.Interface([
  "function executeNAVUpdate(address navExecutor)",
]);
// The two modifier generations differ in exactly the argument that names the
// role: uint16 on V1, bytes32 on V2.
const ROLES_V1_INTERFACE = new ethers.Interface([
  "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, uint16 role, bool shouldRevert)",
]);
const ROLES_V2_INTERFACE = new ethers.Interface([
  "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert)",
]);

export type FirstNavRolesVersion = "V1" | "V2";

export interface IFirstNavRoute {
  rolesModAddress: string;
  /** Decimal string on V1; a label or an encoded bytes32 on V2. */
  role: string;
  version: FirstNavRolesVersion;
}

/** executeNAVUpdate(navExecutor), as sent to the vault. */
export const encodeFirstNavUpdate = (navExecutorAddress: string): string =>
  FUND_INTERFACE.encodeFunctionData("executeNAVUpdate", [navExecutorAddress]);

const roleArgument = (
  version: FirstNavRolesVersion,
  role: string,
): string | number => {
  if (version === "V1") return Number(role);
  return ethers.isHexString(role, 32) ? role : ethers.encodeBytes32String(role);
};

/** The NAV update wrapped for the modifier, under `route`'s role. */
export const encodeFirstNavExecution = (
  fundAddress: string,
  navExecutorAddress: string,
  route: IFirstNavRoute,
): string =>
  (route.version === "V1"
    ? ROLES_V1_INTERFACE
    : ROLES_V2_INTERFACE
  ).encodeFunctionData("execTransactionWithRole", [
    fundAddress,
    0,
    encodeFirstNavUpdate(navExecutorAddress),
    0, // Operation.Call
    roleArgument(route.version, route.role),
    true, // shouldRevert — a failed NAV update must take the finalize with it
  ]);

/**
 * The batch, in the only order that works: the vault is uninitialised until
 * finalize, so the NAV update has to come second.
 */
export const buildFinalizeWithFirstNavCalls = ({
  factoryAddress,
  fundAddress,
  navExecutorAddress,
  route,
}: {
  factoryAddress: string;
  fundAddress: string;
  navExecutorAddress: string;
  route: IFirstNavRoute;
}): WalletBatchCall[] => [
  {
    to: factoryAddress,
    data: FACTORY_INTERFACE.encodeFunctionData("finalizeCreateFund", []),
  },
  {
    to: route.rolesModAddress,
    data: encodeFirstNavExecution(fundAddress, navExecutorAddress, route),
  },
];

/**
 * Roles worth trying for the NAV update, most likely first: whatever the
 * wallet is known to hold, then the keys the factories hand their deployer.
 * Both spellings of the V2 manager key are listed because both are live — the
 * app's constant carries a typo that some factories do not share.
 */
export const firstNavRoleCandidates = (
  version: FirstNavRolesVersion,
  heldRoles: string[] = [],
): string[] => {
  const defaults =
    version === "V1" ? ["1"] : ["defaultManagerRole", "defaulManagerRole"];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const role of [...heldRoles, ...defaults]) {
    const key = String(roleArgument(version, role)).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(role);
  }
  return candidates;
};

/**
 * Before finalize the vault is uninitialised, so a dry-run of the wrapped NAV
 * update cannot succeed — but how it fails still answers the question. A
 * revert from the target ("inner revert") means the modifier let the call
 * through; a membership or condition error means it would not. The first role
 * that gets past the modifier is the one to send under.
 */
export const pickFirstNavRole = async (
  candidates: string[],
  simulate: (role: string) => Promise<{ ok: boolean; innerRevert?: boolean }>,
): Promise<string | undefined> => {
  for (const role of candidates) {
    try {
      const result = await simulate(role);
      if (result.ok || result.innerRevert) return role;
    } catch {
      // An RPC failure says nothing about this role; try the next one.
    }
  }
  return undefined;
};

/**
 * How the finalize and the first NAV update can travel, from what the wallet
 * reports about the connected account:
 *
 *   "atomic"      the account already executes batches (a smart account, or
 *                 an EOA upgraded earlier), so one transaction is certain.
 *   "upgrade"     the wallet batches only after switching the account to a
 *                 smart account. It asks for that inside the confirmation and
 *                 the user can refuse, or have the offer turned off, so one
 *                 transaction is possible but not promised.
 *   "sequential"  the wallet does not batch for this account on this chain.
 *
 * "ready" is deliberately not folded into "atomic": telling the user the NAV
 * update "runs in the same transaction" when that still hinges on an account
 * switch is how a finalize-only prompt reached a wallet that expected a batch.
 */
export type FirstNavDelivery = "atomic" | "upgrade" | "sequential";

export const firstNavDeliveryFor = (
  status: AtomicBatchStatus,
): FirstNavDelivery => {
  if (status === "supported") return "atomic";
  if (status === "ready") return "upgrade";
  return "sequential";
};

/**
 * What became of the batch:
 *
 *   "success"           both calls landed in one transaction.
 *   "stopped"           the user declined it, or it failed; toasts are up.
 *   "upgrade_declined"  the wallet did not switch the account (refused in the
 *                       confirmation, or switched off in its settings).
 *   "unsupported"       the wallet turned the batch down outright.
 */
export type FinalizeBatchOutcome =
  | "success"
  | "stopped"
  | "upgrade_declined"
  | "unsupported";

/**
 * What the Finalize step does once the batch has answered. A batch the wallet
 * would not take never turns into a transaction by itself: nothing has been
 * sent at that point, and sending the finalize alone opens the window the
 * batch exists to close. The step-by-step dialog opens instead and waits for
 * a click on each confirmation.
 */
export type AfterFinalizeBatch = "finalized" | "stop" | "steps";

export const afterFinalizeBatch = (
  outcome: FinalizeBatchOutcome,
): AfterFinalizeBatch => {
  if (outcome === "success") return "finalized";
  if (outcome === "stopped") return "stop";
  return "steps";
};
