export enum FundTransactionType {
  Deposit = "Deposit",
  Redemption = "Redemption",
}

// GovernableFundStorage.sol storage slot indices
export const FundTransactionTypeStorageSlotIdxMap: Record<FundTransactionType, number> = {
  [FundTransactionType.Deposit]: 273,
  [FundTransactionType.Redemption]: 274,
}
