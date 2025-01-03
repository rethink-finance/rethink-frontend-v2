export default interface IFundSettings {
  [key: string]: any;
  depositFee: string;
  withdrawFee: string;
  performancePeriod: string;
  performanceFee: string;
  managementPeriod: string;
  managementFee: string;
  feeCollectors: string[];
  // TODO Here we have a typo, we should fix this in the original interface: IGovernableFundStorage
  performaceHurdleRateBps?: string;
  baseToken: string;
  baseDecimals?: number;
  baseSymbol?: string;
  safe?: string;
  isExternalGovTokenInUse?: boolean;
  isWhitelistedDeposits?: boolean;
  allowedDepositAddrs?: string[];
  allowedManagers?: string[];
  governanceToken?: string;
  governor?: string;
  fundAddress: string;
  fundName: string;
  fundSymbol: string;
}

export interface IFundInitCache {
  fundContractAddr: string;
  rolesModifier: string;
  fundSettings: IFundSettings;
  _feeManagePeriod: string;
  _feePerformancePeriod: string;
  _fundMetadata: string;
  fundMetadata: Record<string, any>;
  governorData: Record<string, any>;
}
