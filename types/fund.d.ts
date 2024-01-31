import type IPositionType from '~/types/position_type';
import type ICyclePendingRequest from '~/types/cycle_pending_request';
import type INAVUpdate from '~/types/nav_update';

export default interface IFund {
  id: number;
  address: string;
  title: string;
  subtitle: string;
  chain: string;
  avatar_url: string;
  description: string;
  // @dev better combine all governor data into one object "governor": {...}
  governor_address: string;
  safe_address: string;
  inception_date: string;
  aum_value: number;
  cumulative_return_percent: number;
  monthly_return_percent: number;
  sharpe_ratio: number;
  user_fund_balance: string;
  user_fund_usd_value: string;
  next_settlement: string;
  position_types: IPositionType[],
  cycle_pending_requests: ICyclePendingRequest[],
  fund_token: IToken,
  denomination_token: IToken,
  governor_token: IToken;
  fund_to_denomination_exchange_rate: number

  // Overview fields
  deposit_addresses: string[],
  management_addresses: string[],
  planned_settlement_cycle: string,
  min_liquid_asset_share: string,
  // Governance
  voting_delay: string,
  voting_period: string,
  proposal_threshold: string,
  quorom: string,
  late_quorom: string,
  // NAV Updates
  nav_updates: INAVUpdate[],
}
