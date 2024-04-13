import type ICyclePendingRequest from '~/types/cycle_pending_request';
import type INAVUpdate from '~/types/nav_update';
import type IPositionType from '~/types/position_type';

/**
 * Example API response data of getFundSettings:
 * allowedDepositAddrs: []
 * allowedManagers: ['0x6EC175951624e1E1e6367Fa3dB90a1829E032Ec3']
 * baseToken: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"
 * depositFee: 100n
 * feeCollectors: (4) ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', '0x6EC175951624e1E1e6367Fa3dB90a1829E032Ec3', '0x000000000000000000000000000000000000000F']
 * fundAddress: "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E"
 * fundName: "Test Fund DAO 1"
 * fundSymbol: "TFD1"
 * governanceToken: "0x0657DC652F88B55Dd16f5D6cE687672264f9b61E"
 * governor: "0x751843c59E6a99EE2647980920D226b96C05d7D1"
 * isExternalGovTokenInUse: false
 * isWhitelistedDeposits: false
 * managementFee: 1000n
 * performaceHurdleRateBps: 0n
 * performanceFee: 0n
 * safe: "0x41d528de21DaEF1B1FEAF66566977e35eE375fd0"
 * withdrawFee: 150n
 */
export default interface IFund {
  address: string;
  title: string;
  subtitle: string;
  chain: string;
  photoUrl: string;
  description: string;
  // @dev better combine all governor data into one object "governor": {...}
  governorAddress: string;  // governor
  safeAddress: string;  // safe

  inceptionDate: string;
  aumValue: number;
  cumulativeReturnPercent: number;
  monthlyReturnPercent: number;
  sharpeRatio: number;
  userBaseTokenBalance: bigint; // in wei
  userFundUsdValue: string;
  nextSettlement: string;
  positionTypes: IPositionType[];
  cyclePendingRequests: ICyclePendingRequest[];
  fundToken: IToken;
  baseToken: IToken;
  governanceToken: IToken;
  fundToBaseExchangeRate: number

  // Metadata
  plannedSettlementPeriod: string;
  minLiquidAssetShare: string;

  // My Fund Positions
  netDeposits: string;
  currentValue: string;
  totalReturn: number;

  // Overview fields
  depositAddresses: string[];
  managementAddresses: string[];

  // Governance
  votingDelay: string;
  votingPeriod: string;
  proposalThreshold: string;
  quorom: string;
  lateQuorom: string;

  // NAV Updates
  navUpdates: INAVUpdate[];
}
