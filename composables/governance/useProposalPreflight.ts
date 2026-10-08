import {
  type IProposalCall,
  type IProposalCallCheck,
  type IProposalPreflight,
  checkRolesCallVersions,
  summarizeProposalPreflight,
} from "~/composables/governance/proposalPreflightCore";
import { TX_GAS_CAPS } from "~/composables/permissions/gasLimit";
import {
  estimateGasFrom,
  simulateDirectCall,
  standardBlockGasLimit,
} from "~/composables/permissions/useRoleExecution";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import type { ChainId } from "~/types/enums/chain_id";
import type { RolesVersion } from "~/types/enums/roles_version";

export type {
  IProposalCall,
  IProposalCallCheck,
  IProposalPreflight,
} from "~/composables/governance/proposalPreflightCore";
export {
  checkRolesCallVersions,
  formatGas,
  summarizeProposalPreflight,
  toProposalCalls,
} from "~/composables/governance/proposalPreflightCore";

/**
 * Pre-flight for a governance proposal: run every action the way the
 * governor will run it on execution, before propose() ever reaches a wallet.
 *
 * A proposal is voted on for a week before anyone learns whether it can
 * execute. Everything below has happened to a real vault and was only found
 * at execution time or later: a Roles call encoded for the other modifier
 * generation; the modifier no longer owned by the governor; a NAV method
 * whose helper panics; and an execution that needs more gas than the chain
 * allows in one transaction (Base caps a transaction at 16,777,216; a
 * 26-method NAV update needs more than that and simply cannot be mined).
 *
 * Two static checks and two chain reads per action:
 * - the selector of a call to the Roles modifier must belong to the ABI of
 *   the modifier generation that is deployed;
 * - eth_call from the governor: the action must not revert;
 * - eth_estimateGas from the governor: the actions execute in ONE
 *   transaction, so their sum (plus the governor's own overhead) must fit
 *   the chain's per-transaction cap and a standard block.
 *
 * Each action is simulated against the current state on its own; a later
 * action that depends on an earlier one's effect is not modelled. That is
 * the limitation of eth_call, and the reason a passed pre-flight is a strong
 * signal rather than a guarantee.
 */
export const preflightProposalCalls = async (
  chainId: ChainId,
  governor: string,
  calls: IProposalCall[],
  rolesModifier?: { address: string; version: RolesVersion | null },
): Promise<IProposalPreflight> => {
  const versionProblems =
    rolesModifier?.address && rolesModifier.version
      ? checkRolesCallVersions(calls, rolesModifier.address, rolesModifier.version)
      : {};
  const txGasCap = TX_GAS_CAPS[chainId as string];

  const checks: IProposalCallCheck[] = [];
  for (const [index, call] of calls.entries()) {
    const selector = call.calldata.slice(0, 10);
    const target = call.target;
    const where = `${selector} on ${target.slice(0, 6)}…${target.slice(-4)}`;
    if (versionProblems[index]) {
      checks.push({ index, target, selector, ok: false, reason: versionProblems[index] });
      continue;
    }
    const roleCall = { to: target, data: call.calldata, value: call.value };
    let simulation: { ok: boolean; reason?: string };
    try {
      simulation = await simulateDirectCall(chainId, governor, roleCall);
    } catch (error: any) {
      // No RPC answered. Not a verdict on the proposal — say so and move on.
      checks.push({
        index,
        target,
        selector,
        ok: true,
        reason: `Action ${index + 1} (${where}) could not be simulated: ${error?.message ?? "no RPC answered"}.`,
      });
      continue;
    }
    if (!simulation.ok) {
      checks.push({
        index,
        target,
        selector,
        ok: false,
        reason: `Action ${index + 1} (${where}) reverts when the governor executes it. ${simulation.reason ?? ""}`.trim(),
      });
      continue;
    }
    const gas = await estimateGasFrom(chainId, governor, roleCall);
    if (gas === undefined && txGasCap) {
      // The call ran uncapped and the estimator refused it. On a chain with a
      // per-transaction cap the estimator searches only up to that cap, so
      // "runs, but cannot be estimated" is what an action that needs more
      // than the cap looks like. Confirm by giving the call exactly the cap.
      let fitsTheCap = true;
      try {
        fitsTheCap = (await simulateDirectCall(chainId, governor, roleCall, txGasCap)).ok;
      } catch {
        /* no RPC answered the probe; leave the estimate unknown */
      }
      if (!fitsTheCap) {
        checks.push({ index, target, selector, ok: true, overTxGasCap: true });
        continue;
      }
    }
    checks.push({ index, target, selector, ok: true, gas });
  }

  const blockGasLimit = await standardBlockGasLimit(chainId);
  return summarizeProposalPreflight(checks, chainId, blockGasLimit);
};

/**
 * Page-side wrapper: runs the pre-flight for the selected vault's governor,
 * reports the outcome in toasts, and says whether to go on to propose().
 * Reverts and an execution over the transaction cap block the proposal;
 * a block-limit overrun and an unavailable simulation only warn.
 */
export const useProposalPreflight = () => {
  const fundStore = useFundStore();
  const toastStore = useToastStore();
  const isPreflighting = ref(false);
  const lastPreflight = ref<IProposalPreflight | null>(null);

  const runPreflight = async (
    calls: IProposalCall[],
    rolesModifier?: { address: string; version: RolesVersion | null },
  ): Promise<boolean> => {
    const fund = fundStore.fund;
    const governor = fund?.governorAddress;
    if (!fund?.chainId || !governor) {
      toastStore.warningToast(
        "The vault's governor is not known yet; the proposal was not simulated.",
      );
      return true;
    }
    isPreflighting.value = true;
    try {
      const result = await preflightProposalCalls(
        fund.chainId,
        governor,
        calls,
        rolesModifier,
      );
      lastPreflight.value = result;
      if (!result.ok || result.overTxGasCap) {
        toastStore.errorToast(
          "This proposal would not execute: " + result.problems.join(" "),
          20000,
        );
        return false;
      }
      const warnings = [
        ...result.problems,
        ...result.warnings,
        ...result.calls.filter((c) => c.ok && c.reason).map((c) => c.reason!),
      ];
      if (warnings.length) toastStore.warningToast(warnings.join(" "), 15000);
      return true;
    } catch (error: any) {
      console.warn("Proposal pre-flight failed", error);
      toastStore.warningToast(
        "The proposal could not be simulated before submission: " +
          (error?.message ?? String(error)),
        10000,
      );
      return true;
    } finally {
      isPreflighting.value = false;
    }
  };

  return { runPreflight, isPreflighting, lastPreflight };
};
