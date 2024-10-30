

export default interface ISubgraphGovernanceProposal {
  id: string;
  proposalId: number;
  voteStart: number;
  voteEnd: number;
  description: string;
  canceled: boolean;
  queued: boolean;
  executed: boolean;
}
