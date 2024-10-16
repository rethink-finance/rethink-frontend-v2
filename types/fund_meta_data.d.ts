

export default interface IFundMetaData {
  cumulativeReturn: bigint;
  startTime: bigint;
  totalNav: bigint;
  totalDepositBal: bigint;
  feeBalance: bigint;
  illiquidLen: bigint;
  liquidLen: bigint;
  nftLen: bigint;
  composableLen: bigint;
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
}
