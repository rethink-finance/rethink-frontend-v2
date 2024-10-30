// helpers/mappers.ts

import { ethers } from "ethers";
import { ProposalState } from "../enums/governance_proposal";
import { ProposalCalldataType } from "../enums/proposal_calldata_type";
import type IGovernanceProposal from "../governance_proposal";
import type ISubgraphGovernanceProposal from "../subgraph_governance_proposal";

export function _mapSubgraphProposalToProposal(
  proposal: ISubgraphGovernanceProposal,
  decodeProposalCallData: (calldata: string) => any,
  totalSupply: number,
  decimals: number,
  quorumNumerator: bigint,
  quorumDenominator: bigint,
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
    } else if (
      roleModAddress &&
      targets[i] === roleModAddress.toLocaleLowerCase()
    ) {
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

  // Calculate total votes and approval rate
  const receipts = proposal.receipts || [];


  // Safely convert to BigInt with fallbacks
  const forVotes = receipts
    .filter((r) => r.support.support === 1)
    .reduce((sum, r) => sum + BigInt(r.weight), BigInt(0));

  const againstVotes = receipts
    .filter((r) => r.support.support === 0)
    .reduce((sum, r) => sum + BigInt(r.weight), BigInt(0));

  const abstainVotes = receipts
    .filter((r) => r.support.support === 2)
    .reduce((sum, r) => sum + BigInt(r.weight), BigInt(0));

  const totalWeight = forVotes + againstVotes + abstainVotes;

  // Convert to numbers for percentage calculations
  const totalWeightNumber = Number(totalWeight);
  const forVotesNumber = Number(forVotes);
  const totalSupplyNumber = Number(totalSupply || 0);
  const quorumVotes =
  (BigInt(totalSupply) * BigInt(quorumNumerator)) / BigInt(quorumDenominator);
  // Calculate rates
  const approvalRate =
    quorumVotes === BigInt(0) && forVotesNumber > 0
      ? 100 // If quorum is 0 and there are FOR votes, approval is 100%
      : quorumVotes > BigInt(0)
        ? Math.min((forVotesNumber / Number(quorumVotes)) * 100, 100) // Cap at 100%
        : 0;

  const participationRate =
    totalSupplyNumber > 0
      ? Math.min((totalWeightNumber / totalSupplyNumber) * 100, 100) // Cap at 100%
      : 0;

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
      ).toDateString()
      : new Date().toDateString(),

    targets,
    values,
    signatures,
    calldatas,
    descriptionHash: ethers.keccak256(ethers.toUtf8Bytes(proposal.description)),
    calldatasDecoded,
    calldataTypes,
    calldataTags,
    state: ProposalState.Pending, // Assuming default state

    createdBlockNumber: BigInt(
      proposal.proposalCreated?.[0]?.transaction?.blockNumber ?? "0",
    ),
    executedBlockNumber: BigInt(
      proposal.proposalExecuted?.[0]?.transaction?.blockNumber ?? "0",
    ),

    approval: approvalRate,
    approvalFormatted: `${parseFloat(approvalRate.toFixed(2))}%`,
    participation: participationRate,
    participationFormatted: `${parseFloat(participationRate.toFixed(2))}%`,
    quorumVotes,
    quorumVotesFormatted: formatTokenValue(quorumVotes, decimals, false),
    forVotes,
    forVotesFormatted: formatTokenValue(forVotes, decimals, false),
    againstVotes,
    againstVotesFormatted: formatTokenValue(againstVotes, decimals, false),
    abstainVotes,
    abstainVotesFormatted: formatTokenValue(abstainVotes, decimals, false),
    totalVotes: totalWeight,
    totalVotesFormatted: formatTokenValue(BigInt(totalWeight), decimals, false),
    totalSupply: BigInt(totalSupply),
    totalSupplyFormatted: formatTokenValue(
      BigInt(totalSupply),
      decimals,
      false,
    ),
  };
}
