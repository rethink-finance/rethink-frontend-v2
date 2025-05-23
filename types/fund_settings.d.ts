import type { ChainId } from "~/types/enums/chain_id";

export default interface IFundSettings {
  [key: string]: any;
  chainId?: ChainId; // additionally added field
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
