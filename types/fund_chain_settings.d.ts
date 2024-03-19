export default interface IFundChainSettings {
  address: string;
  depositFee?: string;
  withdrawFee?: string;
  performanceFee?: string;
  managementFee?: string;
  performaceHurdleRateBps?: string;
  baseToken?: string;
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