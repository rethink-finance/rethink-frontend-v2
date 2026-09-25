import { ethers } from "ethers";
import RolesFullV1 from "~/assets/contracts/zodiac/RolesFull.json";
import RolesFullV2 from "~/assets/contracts/zodiac/RolesFullV2.json";
import { TX_GAS_CAPS } from "~/composables/permissions/gasLimit";
import type { ChainId } from "~/types/enums/chain_id";
import { RolesVersion } from "~/types/enums/roles_version";

/**
 * The store-free half of the proposal pre-flight (see useProposalPreflight):
 * the static Roles-ABI check and the verdict arithmetic, kept importable by
 * unit tests without dragging the stores in.
 */

export interface IProposalCall {
  target: string;
  calldata: string;
  value?: string;
}

export interface IProposalCallCheck {
  index: number;
  target: string;
  selector: string;
  ok: boolean;
  reason?: string;
  gas?: number;
  /**
   * This one action alone needs more gas than the chain allows in a
   * transaction: it runs in an uncapped eth_call but reverts once the call is
   * given the cap as its gas limit (and eth_estimateGas refuses it). The
   * INDEFI signature — a 26-method NAV update on Base.
   */
  overTxGasCap?: boolean;
}

export interface IProposalPreflight {
  calls: IProposalCallCheck[];
  /** No action reverted and every static check passed. */
  ok: boolean;
  /** Sum of the actions' estimates plus the governor's overhead, when known. */
  totalGas?: number;
  txGasCap?: number;
  blockGasLimit?: number;
  /** The execution could not fit one transaction on this chain. */
  overTxGasCap: boolean;
  /** The execution needs more than a standard block gives one transaction. */
  overBlockLimit: boolean;
  /** Human-readable findings that make the proposal unexecutable, worst first. */
  problems: string[];
  /** Things the check could not establish; the proposal may still go out. */
  warnings: string[];
}

/**
 * What the governor spends on top of the actions themselves: the OZ Governor
 * bookkeeping of execute() and the outer call frames. Measured on the fork
 * runs that verified the INDEFI proposals (4.67M of actions → 5.11M executed).
 */
export const GOVERNOR_EXECUTE_OVERHEAD = 450_000;

const v1Iface = new ethers.Interface((RolesFullV1 as any).abi);
const v2Iface = new ethers.Interface((RolesFullV2 as any).abi);
const selectorsOf = (iface: ethers.Interface) =>
  new Set(
    iface.fragments
      .filter((f) => f.type === "function")
      .map((f) => (f as ethers.FunctionFragment).selector.toLowerCase()),
  );
const V1_SELECTORS = selectorsOf(v1Iface);
const V2_SELECTORS = selectorsOf(v2Iface);

const functionName = (iface: ethers.Interface, selector: string) => {
  try {
    return iface.getFunction(selector)?.name ?? selector;
  } catch {
    return selector;
  }
};

/**
 * Static check: every call aimed at the Roles modifier must use a selector
 * the deployed generation has. Returns one message per offending call, keyed
 * by call index.
 */
export const checkRolesCallVersions = (
  calls: IProposalCall[],
  rolesModAddress: string,
  version: RolesVersion,
): Record<number, string> => {
  const problems: Record<number, string> = {};
  if (!rolesModAddress) return problems;
  const modifier = rolesModAddress.toLowerCase();
  const own = version === RolesVersion.V1 ? V1_SELECTORS : V2_SELECTORS;
  const other = version === RolesVersion.V1 ? V2_SELECTORS : V1_SELECTORS;
  const otherIface = version === RolesVersion.V1 ? v2Iface : v1Iface;
  const otherLabel = version === RolesVersion.V1 ? "v2" : "v1";
  const ownLabel = version === RolesVersion.V1 ? "v1" : "v2";

  calls.forEach((call, index) => {
    if (call.target.toLowerCase() !== modifier) return;
    const selector = call.calldata.slice(0, 10).toLowerCase();
    if (own.has(selector)) return;
    problems[index] = other.has(selector)
      ? `Action ${index + 1} calls ${functionName(otherIface, selector)} with the Roles ${otherLabel} ABI, but this vault's modifier is Roles ${ownLabel}; the modifier would reject it.`
      : `Action ${index + 1} calls a function (${selector}) the Roles ${ownLabel} modifier does not have.`;
  });
  return problems;
};

export const formatGas = (gas: number) =>
  `${(gas / 1_000_000).toFixed(gas >= 10_000_000 ? 1 : 2)}M`;

/** Fold per-action results into the verdict. */
export const summarizeProposalPreflight = (
  calls: IProposalCallCheck[],
  chainId: ChainId | string,
  blockGasLimit?: number,
): IProposalPreflight => {
  const txGasCap = TX_GAS_CAPS[chainId as string];
  const estimates = calls
    .map((c) => c.gas)
    .filter((g): g is number => g !== undefined);
  const totalGas =
    calls.length && estimates.length === calls.length
      ? estimates.reduce((a, b) => a + b, 0) + GOVERNOR_EXECUTE_OVERHEAD
      : undefined;
  const actionOverCap = calls.filter((c) => c.overTxGasCap);
  const overTxGasCap =
    actionOverCap.length > 0 ||
    (!!txGasCap && !!totalGas && totalGas > txGasCap);
  const overBlockLimit =
    !!blockGasLimit && !!totalGas && totalGas > blockGasLimit;

  const problems: string[] = [];
  const warnings: string[] = [];
  for (const call of calls) {
    if (!call.ok) problems.push(call.reason ?? `Action ${call.index + 1} reverts.`);
  }
  for (const call of actionOverCap) {
    problems.push(
      `Action ${call.index + 1} (${call.selector}) alone needs more gas than this chain allows in one transaction (${txGasCap ? formatGas(txGasCap) : "the cap"}). It could pass the vote and still never execute. Remove actions (for a NAV proposal: methods) until it fits.`,
    );
  }
  if (overTxGasCap && !actionOverCap.length) {
    problems.push(
      `Executing this proposal needs about ${formatGas(totalGas!)} gas in one transaction, but this chain caps a transaction at ${formatGas(txGasCap)}. It could pass the vote and still never execute. Remove actions (for a NAV proposal: methods) until it fits.`,
    );
  } else if (overBlockLimit) {
    problems.push(
      `Executing this proposal needs about ${formatGas(totalGas!)} gas, more than a standard block on this chain (${formatGas(blockGasLimit!)}) gives one transaction.`,
    );
  }
  const unestimated = calls.filter((c) => c.ok && c.gas === undefined && !c.overTxGasCap);
  if (unestimated.length && !actionOverCap.length) {
    warnings.push(
      `Gas could not be estimated for action${unestimated.length === 1 ? "" : "s"} ${unestimated.map((c) => c.index + 1).join(", ")}, so the execution cost was not checked against the chain's limits.`,
    );
  }
  return {
    calls,
    ok: calls.every((c) => c.ok),
    totalGas,
    txGasCap,
    blockGasLimit,
    overTxGasCap,
    overBlockLimit,
    problems,
    warnings,
  };
};

/** Pair a proposal's targets and calldatas into the pre-flight's input. */
export const toProposalCalls = (
  targets: string[],
  calldatas: string[],
  values?: (number | string)[],
): IProposalCall[] =>
  targets.map((target, i) => ({
    target,
    calldata: calldatas[i],
    value: values?.[i] !== undefined ? String(values[i]) : undefined,
  }));
