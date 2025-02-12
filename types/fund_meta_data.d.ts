import type IFundGovernanceData from "./fund_governance_data";


export default interface IFundMetaData {
  startTime: bigint;
  updateTimes: any;
  totalDepositBal: bigint;
  feeBalance: bigint;
  feePerformancePeriod: bigint;
  feeManagePeriod: bigint;
  fundTokenDecimals: bigint;
  fundBaseTokenDecimals: bigint;
  fundTokenSupply: bigint;
  fundBaseTokenSupply: bigint;
  fundGovernanceTokenSupply: bigint;
  safeContractBaseTokenBalance: bigint;
  fundContractBaseTokenBalance: bigint;
  fundMetadata: string;
  fundName: string;
  fundBaseTokenSymbol: string;
  fundGovernanceTokenSymbol: string;
  fundGovernanceData: IFundGovernanceData;
  fundSettings: any;
}
