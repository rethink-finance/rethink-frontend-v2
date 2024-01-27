import type IPositionType from '~/types/position_type';
import type ICyclePendingRequest from '~/types/cycle_pending_request';

export default interface IFund {
  id: number;
  address: string;
  title: string;
  subtitle: string;
  chain: string;
  avatar_url: string;
  description: string;
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
  fund_to_denomination_exchange_rate: number
}
