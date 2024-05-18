import type IValuationType from "~/types/valuation_type";

export enum ValuationType {
  DEXPair = "dex_pair",
  Aggregator = "aggregator",
}
export const ValuationTypesMap: Record<string, IValuationType> = {
  [ValuationType.DEXPair]: {
    name: "DEX Pair",
    key: ValuationType.DEXPair,
  },
  [ValuationType.Aggregator]: {
    name: "Aggregator",
    key: ValuationType.Aggregator,
  },
};

export const ValuationTypes = Object.values(ValuationTypesMap);
export const ValuationTypeKeys = Object.values(ValuationType);
