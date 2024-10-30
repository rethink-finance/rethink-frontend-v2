// helpers/mappers.ts

import { ProposalState } from "../enums/governance_proposal";
import type IGovernanceProposal from "../governance_proposal";
import type ISubgraphGovernanceProposal from "../subgraph_governance_proposal";

export function _mapSubgraphProposalToProposal(
  proposal: ISubgraphGovernanceProposal,
): IGovernanceProposal {
  return {
    proposalId: proposal.id,
    proposer: "", // Placeholder, as `proposer` isn’t provided in ISubgraphGovernanceProposal
    title: "", // Placeholder, can be derived if needed
    description: proposal.description,
    voteStart: proposal.voteStart.toString(),
    voteEnd: proposal.voteEnd.toString(),
    voteStartTimestamp: proposal.voteStart.toString(), // Assuming we can use `voteStart` as a timestamp for simplicity
    voteEndTimestamp: proposal.voteEnd.toString(), // Assuming we can use `voteEnd` as a timestamp

    // Default or placeholder values for fields not available in the subgraph response:
    targets: [],
    values: [],
    signatures: [],
    calldatas: [],
    descriptionHash: "",
    calldatasDecoded: [],
    calldataTypes: [],
    calldataTags: [],
    state: ProposalState.Pending, // Assuming default state

    createdTimestamp: Date.now(),
    createdBlockNumber: BigInt(0),
    createdDatetimeFormatted: new Date().toISOString(),

    executedTimestamp: proposal.executed ? Date.now() : 0,
    executedBlockNumber: BigInt(0),

    approval: 0,
    approvalFormatted: "0%",
    participation: 0,
    participationFormatted: "0%",
    quorumVotes: BigInt(0),
    quorumVotesFormatted: "0",
    forVotes: BigInt(0),
    forVotesFormatted: "0",
    abstainVotes: BigInt(0),
    abstainVotesFormatted: "0",
    againstVotes: BigInt(0),
    againstVotesFormatted: "0",
    totalVotes: BigInt(0),
    totalVotesFormatted: "0",
    totalSupply: BigInt(0),
    totalSupplyFormatted: "0",
  };
}
