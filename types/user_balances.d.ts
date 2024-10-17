import type IFundTransactionRequest from "./fund_transaction_request";

export default interface IUserBalances {
  baseTokenBalance: bigint;
  fundTokenBalance: bigint;
  governanceTokenBalance: bigint;
  fundAllowance: bigint;
  fundShareValue: bigint;
  fundDelegateAddress: string;
  depositRequest?: IFundTransactionRequest;
  redemptionRequest?: IFundTransactionRequest;
}
