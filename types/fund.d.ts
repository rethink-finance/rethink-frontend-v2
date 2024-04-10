import type ICyclePendingRequest from '~/types/cycle_pending_request';
import type INAVUpdate from '~/types/nav_update';
import type IPositionType from '~/types/position_type';

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
  userFundBalance: string;
  userFundUsdValue: string;
  nextSettlement: string;
  positionTypes: IPositionType[];
  cyclePendingRequests: ICyclePendingRequest[];
  fundToken: IToken;
  denominationToken: IToken;
  governorToken: IToken;
  fundToDenominationExchangeRate: number

  // My Fund Positions
  netDeposits: string;
  currentValue: string;
  totalReturn: number;
  delegatingAddress: string;
  votingPower: string;

  // Overview fields
  depositAddresses: string[];
  managementAddresses: string[];
  plannedSettlementCycle: string;
  minLiquidAssetShare: string;

  // Governance
  votingDelay: string;
  votingPeriod: string;
  proposalThreshold: string;
  quorom: string;
  lateQuorom: string;

  // NAV Updates
  navUpdates: INAVUpdate[];
}
