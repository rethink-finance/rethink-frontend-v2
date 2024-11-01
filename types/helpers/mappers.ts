// helpers/mappers.ts

import { ethers } from "ethers";
import type BlockTimeContext from "../block_time_context";
import type IDelegate from "../delegate";
import type IDelegator from "../delegator";
import { ClockMode } from "../enums/clock_mode";
import { ProposalState } from "../enums/governance_proposal";
import { ProposalCalldataType } from "../enums/proposal_calldata_type";
import type IGovernanceProposal from "../governance_proposal";
import type ISubgraphFetchDelegatesResponse from "../responses/subgraph_fetch_delegates";
import type ISubgraphGovernanceProposal from "../subgraph_governance_proposal";
import type ITrendingDelegate from "../trending_delegate";

export async function _mapSubgraphProposalToProposal(
  proposal: ISubgraphGovernanceProposal,
  decodeProposalCallData: (calldata: string) => any,
  totalSupply: number,
  blockTimeContext: BlockTimeContext,
  decimals: number,
  quorumNumerator: bigint,
  quorumDenominator: bigint,
  getTimestampForBlock: (
    targetBlock: number,
    context: BlockTimeContext,
  ) => Promise<number>,
  clockMode: ClockMode,
  roleModAddress?: string,
  safeAddress?: string,
): Promise<Promise<IGovernanceProposal>> {
  let voteStartTimestamp: number | undefined;
  let voteEndTimestamp: number | undefined;
  if (clockMode === ClockMode.Timestamp) {
    console.log("debug: Using timestamp for vote start and end");
    voteStartTimestamp = proposal.voteStart;
    voteEndTimestamp = proposal.voteEnd;
  } else if (clockMode === ClockMode.BlockNumber) {
    console.log("debug: Using block number for vote start and end");
    voteStartTimestamp = await getTimestampForBlock(
      Number(proposal.voteStart),
      blockTimeContext,
    );
    voteEndTimestamp = await getTimestampForBlock(
      Number(proposal.voteEnd),
      blockTimeContext,
    );
    console.log("debug: Got timestamps:", {
      start: voteStartTimestamp,
      end: voteEndTimestamp,
    });
  } else {
    voteStartTimestamp = undefined;
    voteEndTimestamp = undefined;
  }

  const parseDescription = (descriptionStr: string) => {
    try {
      const parsed = JSON.parse(descriptionStr);
      return {
        title: parsed.title,
        description: parsed.description,
      };
    } catch (e) {
      return {
        title: descriptionStr.split("\n")[0],
        description: descriptionStr,
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

  const receipts = proposal.receipts || [];

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

  const totalWeightNumber = Number(totalWeight);
  const forVotesNumber = Number(forVotes);
  const totalSupplyNumber = Number(totalSupply || 0);
  const quorumVotes =
    (BigInt(totalSupply) * BigInt(quorumNumerator)) / BigInt(quorumDenominator);

  const approvalRate =
    quorumVotes === BigInt(0) && forVotesNumber > 0
      ? 100
      : quorumVotes > BigInt(0)
        ? Math.min((forVotesNumber / Number(quorumVotes)) * 100, 100)
        : 0;

  const participationRate =
    totalSupplyNumber > 0
      ? Math.min((totalWeightNumber / totalSupplyNumber) * 100, 100)
      : 0;

  // Derive state
  let state: ProposalState;
  const now = Math.floor(Date.now() / 1000);
  console.log("debug", voteStartTimestamp, voteEndTimestamp, now);

  if (proposal.proposalCanceled?.[0]?.timestamp) {
    state = ProposalState.Canceled;
  } else if (proposal.proposalExecuted?.[0]?.timestamp) {
    state = ProposalState.Executed;
  } else if (proposal.proposalQueued?.[0]?.timestamp) {
    state = ProposalState.Queued;
  } else if (now < Number(voteStartTimestamp)) {
    state = ProposalState.Pending;
  } else if (
    now >= Number(voteStartTimestamp) &&
    now < Number(voteEndTimestamp)
  ) {
    state = ProposalState.Active;
  } else if (now >= Number(voteEndTimestamp)) {
    const quorumReached = totalWeight >= quorumVotes;

    state =
      quorumReached && forVotes > againstVotes
        ? ProposalState.Succeeded
        : ProposalState.Defeated;
  } else {
    state = ProposalState.Pending;
  }

  return {
    proposalId: proposal.proposalId.toString(),
    proposer: proposal.proposer.id,
    title: parsedDescription.title,
    description: parsedDescription.description,
    voteStart: proposal.voteStart.toString(),
    voteEnd: proposal.voteEnd.toString(),
    voteStartTimestamp: voteStartTimestamp?.toString(),
    voteEndTimestamp: voteEndTimestamp?.toString(),

    createdTimestamp: Number(proposal.proposalCreated?.[0]?.timestamp),
    executedTimestamp: Number(proposal.proposalExecuted?.[0]?.timestamp),

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
    state,

    createdBlockNumber: BigInt(
      proposal.proposalCreated?.[0]?.transaction?.blockNumber ?? "0",
    ),
    executedBlockNumber: BigInt(
      proposal.proposalExecuted?.[0]?.transaction?.blockNumber ?? "0",
    ),

    approval: approvalRate / 100,
    approvalFormatted: `${parseFloat(approvalRate.toFixed(2))}%`,
    participation: participationRate / 100,
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

export function _mapSubgraphFetchDelegatesToDelegates(
  response: ISubgraphFetchDelegatesResponse,
  decimals: number,
): IDelegate[] {
  if (!response?.weight) {
    return [];
  }

  const totalSupply = response.totalWeight?.value || "0";

  return response.weight.map((weightData) => {
    // Safely map delegators with optional chaining
    const delegators: IDelegator[] =
      weightData.account?.delegationFrom?.map((d) => ({
        address: d.delegator.id || "",
        weight: d.delegator?.voteWeigth?.[0]?.value || "0",
      })) || [];

    const votingPowerPercent =
      totalSupply !== "0"
        ? ((Number(weightData.value || 0) / Number(totalSupply)) * 100).toFixed(2)
        : "0";

    return {
      address: weightData.account?.id || "",
      delegators,
      delegatorCount: delegators.length,
      votingPower: formatTokenValue(BigInt(weightData.value || "0"), decimals, false),
      votingPowerPercent: `${votingPowerPercent}%`,
    };
  });
}

export function _mapDelegatesToTrendingDelegates(
  delegates: IDelegate[],
): ITrendingDelegate[] {
  return delegates.map((delegate) => ({
    delegatedMember: delegate.address,
    delegators: delegate.delegators.map((d) => d.address),
    delegatorsEvents: [], // Empty array since we don't have this data
    impact: delegate.votingPowerPercent, // Using votingPowerPercent as impact
    votingPower: delegate.votingPower,
  }));
}
