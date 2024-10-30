export default interface ISubgraphGovernanceProposal {
  id: string;
  proposalId: number;
  voteStart: number;
  voteEnd: number;
  description: string;
  canceled: boolean;
  queued: boolean;
  executed: boolean;
  proposalCanceled: Array<{
    timestamp: string;
  }>;
  proposalCreated: Array<{
    timestamp: string;
  }>;
  proposalExecuted: Array<{
    timestamp: string;
  }>;
  proposalQueued: Array<{
    timestamp: string;
  }>;
  calls: Array<{
    calldata: string;
    index: number;
    signature: string;
    value: string;
    target: {
      id: string;
    };
  }>;
}
