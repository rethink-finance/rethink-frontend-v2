import type IFundTransactionRequest from "./fund/fund_transaction_request";

export default interface IFundUserData {
  baseTokenBalance: bigint;
  fundTokenBalance: bigint;
  governanceTokenBalance: bigint;
  fundAllowance: bigint;
  fundShareValue: bigint;
  fundDelegateAddress: string;
  depositRequest?: IFundTransactionRequest;
  redemptionRequest?: IFundTransactionRequest;
}
