
export interface IChartType {
    value: string;
    key: string;
}

export enum ChartType {
  NAV = "nav",
  SHARE_PRICE = "share-price",
  MARKET_VALUE = "market-value",
}

export const ChartTypesMap: Record<ChartType, IChartType> = {
  [ChartType.NAV]: {
    value: "NAV",
    key: ChartType.NAV,
  },
  [ChartType.SHARE_PRICE]: {
    value: "Share Price",
    key: ChartType.SHARE_PRICE,
  },
  [ChartType.MARKET_VALUE]: {
    value: "Market Value",
    key: ChartType.MARKET_VALUE,
  },
};
