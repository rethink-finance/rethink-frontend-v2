import { ethers } from "ethers";
import { GovernableFund } from "~/assets/contracts/GovernableFund";
import { ProposalState } from "~/types/enums/governance_proposal";
import type IGovernanceProposal from "~/types/governance_proposal";

/**
 * Finds activation proposals already submitted for a vault, so the
 * Permissions page stops offering to create another while one is in flight.
 *
 * A proposal counts when it is still live (pending, voting, passed but not
 * executed, or queued) and carries the activation call itself:
 * - ownership: rolesModifier.transferOwnership(safe)
 * - settings: fund.updateSettings(...) with governor = safe
 *
 * Matching on the calls, not the title, also catches activation proposals
 * written by hand or from another tool.
 */

const TRANSFER_OWNERSHIP_SELECTOR = "0xf2fde38b";

const LIVE_STATES = new Set<ProposalState>([
  ProposalState.Pending,
  ProposalState.Active,
  ProposalState.Succeeded,
  ProposalState.Queued,
]);

const fundInterface = new ethers.Interface(GovernableFund.abi as any);
const UPDATE_SETTINGS_SELECTOR = fundInterface.getFunction("updateSettings")!.selector;

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

const isTransferOwnershipTo = (calldata: string, safe: string): boolean => {
  if (!calldata?.toLowerCase().startsWith(TRANSFER_OWNERSHIP_SELECTOR)) return false;
  try {
    const [newOwner] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address"],
      "0x" + calldata.slice(10),
    );
    return eq(newOwner, safe);
  } catch {
    return false;
  }
};

const isGovernorMigrationTo = (calldata: string, safe: string): boolean => {
  if (!calldata?.toLowerCase().startsWith(UPDATE_SETTINGS_SELECTOR)) return false;
  try {
    const decoded = fundInterface.decodeFunctionData("updateSettings", calldata);
    return eq(decoded[0]?.governor, safe);
  } catch {
    return false;
  }
};

export interface IActivationProposals {
  ownership?: IGovernanceProposal;
  settings?: IGovernanceProposal;
}

export const findActivationProposals = (
  proposals: IGovernanceProposal[] | undefined,
  vault: { fundAddress: string; rolesModifier: string | null; safe: string },
): IActivationProposals => {
  const found: IActivationProposals = {};
  if (!vault.safe) return found;
  // Newest first, so the most recent of several live proposals is the one linked.
  const live = (proposals ?? [])
    .filter((proposal) => LIVE_STATES.has(proposal.state))
    .sort((a, b) => Number(b.createdBlockNumber ?? 0) - Number(a.createdBlockNumber ?? 0));

  for (const proposal of live) {
    (proposal.targets ?? []).forEach((target, index) => {
      const calldata = proposal.calldatas?.[index] ?? "";
      if (
        !found.ownership &&
        eq(target, vault.rolesModifier) &&
        isTransferOwnershipTo(calldata, vault.safe)
      ) {
        found.ownership = proposal;
      }
      if (
        !found.settings &&
        eq(target, vault.fundAddress) &&
        isGovernorMigrationTo(calldata, vault.safe)
      ) {
        found.settings = proposal;
      }
    });
  }
  return found;
};

/** One short line on where a live proposal stands. */
export const activationProposalStatus = (state: ProposalState): string => {
  switch (state) {
    case ProposalState.Pending:
      return "Waiting for voting to start";
    case ProposalState.Active:
      return "Voting is open";
    case ProposalState.Succeeded:
      return "Passed, waiting to be executed";
    case ProposalState.Queued:
      return "Queued for execution";
    default:
      return state;
  }
};
