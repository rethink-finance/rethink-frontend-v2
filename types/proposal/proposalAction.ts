import type { ProposalCalldataType } from "~/types/enums/proposal_calldata_type";

/**
 * One call a governance proposal makes, as the proposal page explains it: the
 * raw target/value/calldata triple plus whatever the decoder made of it.
 */
export interface IProposalAction {
  /** Position in the proposal's calldata list. */
  index: number;
  target: string;
  /** wei, as a decimal string */
  value: string;
  calldata: string;
  type?: ProposalCalldataType;
  functionName?: string;
  contractName?: string;
  decoded?: Record<string, any>;
  /** A caption for a call that is only there for technical reasons. */
  note?: string;
}
