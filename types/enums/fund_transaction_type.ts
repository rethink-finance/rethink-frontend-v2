export enum FundTransactionType {
  Deposit = "Deposit",
  Withdrawal = "Withdrawal",
}

// GovernableFundStorage.sol storage slot indices
export const FundTransactionTypeStorageSlotIdxMap: Record<FundTransactionType, number> = {
  [FundTransactionType.Deposit]: 273,
  [FundTransactionType.Withdrawal]: 274,
}
