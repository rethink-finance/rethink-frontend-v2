
export interface IChartType {
    value: string;
    key: string;
}

export enum ChartType {
  NAV = "nav",
  SHARE_PRICE = "share-price"
}

// Stroke Colors
export const ChartTypeStrokeColors = {
  [ChartType.NAV]: "var(--color-primary)",
  [ChartType.SHARE_PRICE]: "var(--color-primary)",
};

export const ChartTypesMap: Record<ChartType, IChartType> = {
  [ChartType.NAV]: {
    value: "NAV",
    key: ChartType.NAV,
  },
  [ChartType.SHARE_PRICE]: {
    value: "Share Price",
    key: ChartType.SHARE_PRICE,
  },

};
