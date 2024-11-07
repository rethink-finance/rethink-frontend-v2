
/** Governance Proposal Enums **/
export enum ProposalState {
  Pending = "Pending",
  Active = "Active",
  Canceled = "Canceled",
  Defeated = "Defeated",
  Succeeded = "Succeeded",
  Queued = "Queued",
  Expired = "Expired",
  Executed = "Executed"
}


// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/governance/extensions/GovernorCountingSimple.sol
export enum VoteType {
  Against = "Reject",
  For = "Approve",
  Abstain = "Abstain"
}

export const VoteTypeFromNumber: Record<number, VoteType> = {
  0: VoteType.Against,
  1: VoteType.For,
  2: VoteType.Abstain,
};
//
// export enum Rounding {
//   Floor = "Floor",
//   Ceil = "Ceil",
//   Trunc = "Trunc",
//   Expand = "Expand"
// }
//
// export enum OperationState {
//   Unset = "Unset",
//   Waiting = "Waiting",
//   Ready = "Ready",
//   Done = "Done"
// }
//
// export enum RevertType {
//   None = "None",
//   RevertWithoutMessage = "RevertWithoutMessage",
//   RevertWithMessage = "RevertWithMessage",
//   RevertWithCustomError = "RevertWithCustomError",
//   Panic = "Panic"
// }

// Mapping objects
export const ProposalStateMapping: { [key: number]: ProposalState } = {
  0: ProposalState.Pending,
  1: ProposalState.Active,
  2: ProposalState.Canceled,
  3: ProposalState.Defeated,
  4: ProposalState.Succeeded,
  5: ProposalState.Queued,
  6: ProposalState.Expired,
  7: ProposalState.Executed,
};
//

export const VoteTypeNumberMapping: Record<VoteType, number> = {
  [VoteType.Against]: 0,
  [VoteType.For]: 1,
  [VoteType.Abstain]: 2,
};
export const VoteTypeMapping: { [key: number]: VoteType } = {
  1: VoteType.For,
  0: VoteType.Against,
  2: VoteType.Abstain,
};
export const VoteTypeIcon = {
  [VoteType.For]: "material-symbols:done",
  [VoteType.Against]: "material-symbols:close",
  [VoteType.Abstain]: "material-symbols:question-mark",
};
export const VoteTypeClass: Record<VoteType, string> = {
  [VoteType.For]: "for",
  [VoteType.Against]: "against",
  [VoteType.Abstain]: "abstain",
};
//
// export const RoundingMapping: { [key: number]: Rounding } = {
//   0: Rounding.Floor,
//   1: Rounding.Ceil,
//   2: Rounding.Trunc,
//   3: Rounding.Expand,
// };
//
// export const OperationStateMapping: { [key: number]: OperationState } = {
//   0: OperationState.Unset,
//   1: OperationState.Waiting,
//   2: OperationState.Ready,
//   3: OperationState.Done,
// };
//
// export const RevertTypeMapping: { [key: number]: RevertType } = {
//   0: RevertType.None,
//   1: RevertType.RevertWithoutMessage,
//   2: RevertType.RevertWithMessage,
//   3: RevertType.RevertWithCustomError,
//   4: RevertType.Panic,
// };
