export default interface IFundSettings {
  [key: string]: any;
  address: string;
  depositFee?: string;
  withdrawFee?: string;
  performanceFee?: string;
  managementFee?: string;
  // TODO Here we have a typo, we should fix this in the original interface: IGovernableFundStorage
  performaceHurdleRateBps?: string;
  baseToken?: string;
  baseSymbol?: string;  // This base token symbol is fetched separately from the baseToken field (ERC20 ABI).
  safe?: string;
  isExternalGovTokenInUse?: boolean;
  isWhitelistedDeposits?: boolean;
  allowedDepositAddrs?: string[];
  allowedManagers?: string[];
  governanceToken?: string;
  fundAddress?: string;
  governor?: string;
  fundName?: string;
  fundSymbol?: string;
}
