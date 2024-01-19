import type IPositionType from '~/types/position_type';

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
  position_types: IPositionType[]
}
