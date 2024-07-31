import type { FundTransactionType } from "~/types/enums/fund_transaction_type";

export default interface IFundTransactionRequest {
  amount: bigint; // in Wei
  timestamp: number;
  type: FundTransactionType,  // Deposit or Withdrawal
}
