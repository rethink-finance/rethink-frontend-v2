export default interface IFundMetadata {
  [key: string]: any;
  description: string;
  photoUrl: string;
  minLiquidAssetShare?: string;
  plannedSettlementPeriod?: string;
}
