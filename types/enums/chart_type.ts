
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
  [ChartType.SHARE_PRICE]: {
    value: "Share price",
    key: ChartType.SHARE_PRICE,
  },
  // The design labels total NAV as "TVL" — same series, clearer name.
  [ChartType.NAV]: {
    value: "TVL",
    key: ChartType.NAV,
  },
};
