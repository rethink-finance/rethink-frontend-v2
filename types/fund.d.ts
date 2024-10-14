import type IClockMode from "~/types/clock_mode";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";
import type IFundSettings from "./fund_settings";

export interface INAVParts {
  baseAssetOIVBal: bigint;
  baseAssetSafeBal: bigint;
  feeBal: bigint;
  totalNAV: bigint;
}

/**
 * Example API response data of getFundSettings:
 * allowedDepositAddrs: []
 * allowedManagers: ['0x6EC175951624e1E1e6367Fa3dB90a1829E032Ec3']
 * baseToken: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"
 * fundAddress: "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E"
 * fundName: "Test Fund DAO 1"
 * fundSymbol: "TFD1"
 * governanceToken: "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E"
 * governor: "0x751843c59E6a99EE2647980920D226b96C05d7D1"
 * isExternalGovTokenInUse: false
 * isWhitelistedDeposits: false
 * feeCollectors: (4) ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', '0x6EC175951624e1E1e6367Fa3dB90a1829E032Ec3', '0x000000000000000000000000000000000000000F']
 * managementFee: 1000n
 * depositFee: 100n
 * performaceHurdleRateBps: 0n
 * performanceFee: 0n
 * withdrawFee: 150n
 * safe: "0x41d528de21DaEF1B1FEAF66566977e35eE375fd0"
 */
export default interface IFund {
  // Original Fund Settings
  originalFundSettings?: IFundSettings;
  // chain data is populated from the current network
  // the user has selected when fetching funds.
  chainName: string;
  chainShort: string;

  address: string;
  title: string;
  // Fetched with: CLOCK_MODE
  clockMode?: IClockMode;

  // Governor address or delegateToAddress
  governorAddress: string; // governor
  safeAddress: string; // safe

  inceptionDate: string;
  fundToken: IToken;
  fundTokenTotalSupply: bigint;
  baseToken: IToken;
  governanceToken: IToken;
  governanceTokenTotalSupply: bigint;
  totalNAVWei: bigint;
  totalDepositBalance: bigint;
  cumulativeReturnPercent?: number;
  monthlyReturnPercent?: number; // TODO
  sharpeRatio?: number; // TODO
  positionTypeCounts: IPositionTypeCount[];

  // Metadata
  photoUrl: string;
  description: string;
  plannedSettlementPeriod: string;
  minLiquidAssetShare: string;

  // My Fund Positions
  netDeposits: string;

  // Overview fields
  isWhitelistedDeposits: boolean;
  allowedDepositAddresses: string[];
  allowedManagerAddresses: string[];

  // Governance
  // https://docs.tally.xyz/user-guides/deploying-governor-daos/choose-governor-parameters#how-to-pick-the-proposal-threshold
  votingDelay: string;
  votingPeriod: string;
  proposalThreshold: string;
  // Quorum:
  // https://docs.tally.xyz/user-guides/tally-contract-compatibility/openzeppelin-governor#quorum
  quorumVotes: bigint;
  quorumVotesFormatted: string;
  // The quorumNumerator and quorumDenominator are used to calculate the minimum number of votes required
  // for a proposal to be considered valid.
  // If quorumNumerator is 20 and quorumDenominator is 100, the quorum fraction is 20/100, which equals 20%.
  // This means that 20% of the total voting power must participate
  // (For votes, and sometimes including Abstain votes) for the proposal to be valid.
  quorumNumerator: bigint;
  quorumDenominator: bigint;
  quorumPercentage: string;
  lateQuorum: string;

  // Fees - fees collector
  // Fees are in BPS
  // 0
  depositFee: string;
  depositFeeAddress: string;
  // 1
  withdrawFee: string;
  withdrawFeeAddress: string;
  // 2
  managementPeriod: string;
  managementFee: string;
  managementFeeAddress: string;
  // 3
  performancePeriod: string;
  performanceFee: string;
  performanceFeeAddress: string;
  performaceHurdleRateBps: string;
  // _feeBal
  feeBalance: bigint;
  safeContractBaseTokenBalance: bigint;
  fundContractBaseTokenBalance: bigint;
  fundContractBaseTokenBalanceError?: boolean;
  fundContractBaseTokenBalanceLoading?: boolean;
  /**
   * [
   *   DepositFee,
   *   WithdrawFee,
   *   ManagementFee,
   *   PerformanceFee
   * ]
   */
  feeCollectors: string[];

  // NAV Updates
  navUpdates: INAVUpdate[];
  isNavUpdatesLoading?: boolean;

  // Deposit & Redemption Requests Balance
  pendingDepositBalance?: bigint;
  pendingRedemptionBalance?: bigint;
  pendingDepositBalanceLoading?: boolean;
  pendingDepositBalanceError?: boolean;
  pendingRedemptionBalanceLoading?: boolean;
  pendingRedemptionBalanceError?: boolean;
}
