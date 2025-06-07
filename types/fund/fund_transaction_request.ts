import type { FundTransactionType } from "~/types/enums/fund_transaction_type";

export default interface IFundTransactionRequest {
  amount: bigint; // in Wei
  settlementAmount: bigint; // Flows V2, in Wei
  totalAmount?: bigint; // Flows V2, in Wei
  settlementEpoch: number; // Flows V2
  settlementRates?: ISettlementRates;
  timestamp: number;
  type: FundTransactionType,  // Deposit or Redemption
}
