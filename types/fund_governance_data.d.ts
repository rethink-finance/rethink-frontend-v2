

export default interface IFundGovernanceData {
  votingDelay: bigint;
  votingPeriod: bigint;
  proposalThreshold: bigint;
  lateQuorumVoteExtension: bigint;
  quorumNumerator: bigint;
  quorumDenominator: bigint;
  clockMode: string;
}
