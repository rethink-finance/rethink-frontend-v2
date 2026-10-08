import { ethers } from "ethers";
import type IProposalData from "~/types/proposal/proposalData";

/**
 * Governance actions that must reach a target AS THE SAFE.
 *
 * After a Roles V2 vault's one-time activation, `settings.governor` is the
 * Safe: the vault's own updateNav ("only gov"), the NAV executor's
 * storeNAVData ("not authorized: gov") and the Roles modifier's admin
 * functions (Ownable, owner = Safe) all reject the RethinkFundGovernor that
 * executes proposals. The governor still controls the Safe — it is the Safe's
 * sole owner with threshold 1 — so a proposal action can be the Safe's
 * execTransaction(target, data) carrying the governor's PRE-VALIDATED
 * signature: r = governor, s = 0, v = 1. The Safe accepts it because the
 * executor of the proposal (msg.sender on the Safe) is that owner. This is
 * the mechanism the Direct Execution page has used from the start.
 *
 * On a V1 vault settings.governor IS the governor, so nothing is wrapped.
 */

const SAFE_IFACE = new ethers.Interface([
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
]);

export const SAFE_EXEC_TRANSACTION_SELECTOR =
  SAFE_IFACE.getFunction("execTransaction")!.selector;

/** The 65-byte pre-validated signature of `owner`: r = owner, s = 0, v = 1. */
export const prevalidatedSignature = (owner: string): string =>
  ethers.concat([
    ethers.zeroPadValue(ethers.getAddress(owner), 32),
    ethers.ZeroHash,
    "0x01",
  ]);

/** Safe.execTransaction(call) with `executor`'s pre-validated signature. */
export const encodeSafeExecTransaction = (
  executor: string,
  call: { to: string; data: string; value?: string | number | bigint },
): string =>
  SAFE_IFACE.encodeFunctionData("execTransaction", [
    call.to,
    call.value ?? 0,
    call.data,
    0, // Operation.Call
    0, // safeTxGas: 0 = all remaining gas, no gas-limit check inside the Safe
    0, // baseGas
    0, // gasPrice: no refund
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    prevalidatedSignature(executor),
  ]);

/**
 * Rewrite every action of `proposal` so it is executed by `safe` on the
 * governor's behalf. `only` restricts the wrapping to some targets (the fee
 * collections, for instance, have no governor check and may stay direct).
 */
export const wrapProposalThroughSafe = (
  proposal: IProposalData,
  safe: string,
  governor: string,
  only?: (target: string, index: number) => boolean,
): IProposalData => ({
  targets: proposal.targets.map((target, i) =>
    !only || only(target, i) ? safe : target,
  ),
  gasValues: proposal.gasValues.map(() => 0),
  calldatas: proposal.calldatas.map((data, i) =>
    !only || only(proposal.targets[i], i)
      ? encodeSafeExecTransaction(governor, {
        to: proposal.targets[i],
        data,
        value: proposal.gasValues[i] ?? 0,
      })
      : data,
  ),
});

/**
 * Whether `governor` can push transactions through `safe` on its own: it is
 * an owner and the threshold is 1. Rethink vaults are created this way; a
 * Safe whose owners changed cannot be driven from a proposal.
 */
export const decodeSafeControl = (
  owners: string[],
  threshold: number | bigint,
  governor: string,
): boolean =>
  Number(threshold) === 1 &&
  owners.some((o) => o.toLowerCase() === governor.toLowerCase());

export { SAFE_IFACE };
