import type { VoteType } from "./enums/governance_proposal";


export default interface IProposalVoteSubmission {
    proposalId: string,
    proposer: string,
    my_vote: boolean,
    submission_status: VoteType.For | VoteType.Against | VoteType.Abstain,
    quorumVotes: string,
    date: string,
}