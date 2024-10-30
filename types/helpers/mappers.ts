// helpers/mappers.ts

import { ethers } from "ethers";
import { ProposalState } from "../enums/governance_proposal";
import { ProposalCalldataType } from "../enums/proposal_calldata_type";
import type IGovernanceProposal from "../governance_proposal";
import type ISubgraphGovernanceProposal from "../subgraph_governance_proposal";

export function _mapSubgraphProposalToProposal(
  proposal: ISubgraphGovernanceProposal,
  decodeProposalCallData: (calldata: string) => any,
  roleModAddress?: string,
  safeAddress?: string,
): IGovernanceProposal {
  const parseDescription = (descriptionStr: string) => {
    try {
      const parsed = JSON.parse(descriptionStr);
      return {
        title: parsed.title,
        description: parsed.description,
      };
    } catch (e) {
      // If JSON parsing fails, treat the entire string as both title and description
      return {
        title: descriptionStr.split("\n")[0], // First line as title
        description: descriptionStr, // Full text as description
      };
    }
  };
  const parsedDescription = parseDescription(proposal.description);
  const calldatas = proposal.calls.map((call) => call.calldata);
  const values = proposal.calls.map((call) => call.value);
  const signatures = proposal.calls.map((call) => call.signature);
  const targets = proposal.calls.map((call) => call.target.id);
  const calldatasDecoded: any[] = [];

  const calldataTypes: ProposalCalldataType[] = [];

  calldatas.forEach((calldata, i) => {
    const calldataDecoded = decodeProposalCallData(calldata);
    calldatasDecoded.push(calldataDecoded);

    if (calldataDecoded?.functionName === "updateNav") {
      calldataTypes.push(ProposalCalldataType.NAV_UPDATE);
    } else if (safeAddress && targets[i] === safeAddress.toLocaleLowerCase()) {
      calldataTypes.push(ProposalCalldataType.DIRECT_EXECUTION);
    } else if (roleModAddress && targets[i] === roleModAddress.toLocaleLowerCase()) {
      calldataTypes.push(ProposalCalldataType.PERMISSIONS);
    } else if (calldataDecoded?.functionName === "updateSettings") {
      calldataTypes.push(ProposalCalldataType.FUND_SETTINGS);
    } else {
      calldataTypes.push(ProposalCalldataType.UNDEFINED);
    }
  });

  const calldataTags = [
    ...new Set(
      calldataTypes.filter(
        (calldataType) => calldataType !== ProposalCalldataType.UNDEFINED,
      ),
    ),
  ];
  return {
    proposalId: proposal.proposalId.toString(),
    proposer: "", // Placeholder, as `proposer` isn’t provided in ISubgraphGovernanceProposal
    title: parsedDescription.title,
    description: parsedDescription.description,
    voteStart: proposal.voteStart.toString(),
    voteEnd: proposal.voteEnd.toString(),
    voteStartTimestamp: proposal.voteStart.toString(), // Assuming we can use `voteStart` as a timestamp for simplicity
    voteEndTimestamp: proposal.voteEnd.toString(), // Assuming we can use `voteEnd` as a timestamp

    createdTimestamp: Number(proposal.proposalCreated?.[0]?.timestamp),
    executedTimestamp: Number(proposal.proposalExecuted?.[0]?.timestamp),

    // Default or placeholder values for fields not available in the subgraph response:
    createdDatetimeFormatted: proposal.proposalCreated?.[0]?.timestamp
      ? new Date(
        Number(proposal.proposalCreated[0].timestamp) * 1000,
      ).toISOString()
      : new Date().toISOString(),

    targets,
    values,
    signatures,
    calldatas,
    descriptionHash: ethers.keccak256(ethers.toUtf8Bytes(proposal.description)),
    calldatasDecoded,
    calldataTypes,
    calldataTags,
    state: ProposalState.Pending, // Assuming default state

    createdBlockNumber: BigInt(0),
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
