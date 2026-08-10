export default interface ISubgraphGovernanceProposal {
  id: string;
  proposalId: number;
  voteStart: number;
  voteEnd: number;
  description: string;
  canceled: boolean;
  queued: boolean;
  executed: boolean;
  proposer: {
    id: string;
  };
  proposalCanceled: Array<{
    timestamp: string;
    transaction: {
      blockNumber: number;
    };
  }>;
  proposalCreated: Array<{
    timestamp: string;
    transaction: {
      blockNumber: number;
    };
  }>;
  proposalExecuted: Array<{
    timestamp: string;
    transaction: {
      blockNumber: number;
    };
  }>;
  proposalQueued: Array<{
    timestamp: string;
    transaction: {
      blockNumber: number;
    };
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
  receipts: Array<{
    id: string;
    voter: {
      id: string;
    };
    support: {
      support: number;
    };
    weight: string;
    voteCasts: Array<{
      transaction: {
        // The transaction hash: the subgraph keys Transaction entities by it.
        id: string;
        timestamp: string;
        blockNumber: number;
      };
    }>;
  }>;
}
