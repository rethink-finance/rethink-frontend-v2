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
  /**
   * Index of the updateNav call whose bytes this storeNAVData call repeats on
   * the NAV executor, so the page can say "the same methods as call N"
   * instead of rendering the method table twice.
   */
  executorCopyOf?: number;
  /**
   * For a Roles scopeTarget call: the functions later calls in the same
   * proposal allow on that target for that role, so the card can say where
   * the actual limits are ("depositV3Now, limits in call 4").
   */
  scopedFunctions?: { index: number; name: string }[];
}
