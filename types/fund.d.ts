import type ICyclePendingRequest from '~/types/cycle_pending_request';
import type INAVUpdate from '~/types/nav_update';
import type IPositionType from '~/types/position_type';

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
  // chain and chainNativeToken are populated from the current network
  // the user has selected when fetching funds.
  chainName: string;
  chainNativeToken: string;
  chainIcon: string;

  address: string;
  title: string;
  subtitle: string;

  // Governor address or delegateToAddress
  governorAddress: string;  // governor
  safeAddress: string;  // safe

  inceptionDate: string;
  fundToken: IToken;
  baseToken: IToken;
  governanceToken: IToken;
  totalNAVWei: bigint;
  fundTokenTotalSupply: bigint;
  cumulativeReturnPercent: number; // TODO
  monthlyReturnPercent: number; // TODO
  sharpeRatio: number; // TODO
  positionTypes: IPositionType[]; // TODO
  cyclePendingRequests: ICyclePendingRequest[]; // TODO

  // Metadata
  photoUrl: string;
  description: string;
  plannedSettlementPeriod: string;
  minLiquidAssetShare: string;

  // My Fund Positions
  netDeposits: string;

  // Overview fields
  depositAddresses: string[];
  managementAddresses: string[];

  // Governance
  votingDelay: string;
  votingPeriod: string;
  proposalThreshold: string;
  quorom: string;
  lateQuorom: string;

  // Fees - fees collector
  performaceHurdleRateBps: string;
  managementFee: string;
  depositFee: string;
  performanceFee: string;
  withdrawFee: string;
  feeCollectors: string[];

  // NAV Updates
  navUpdates: INAVUpdate[];
}
