import type IValuationType from "~/types/valuation_type";

export enum ValuationType {
  DEXPair = "dex_pair",
  Aggregator = "aggregator",
  ERC20 = "erc-20",
  ERC721 = "erc-721",
  ERC1155 = "erc-1155",
}

export const ValuationTypesMap: Record<ValuationType, IValuationType> = {
  [ValuationType.DEXPair]: {
    name: "DEX Pair",
    key: ValuationType.DEXPair,
  },
  [ValuationType.Aggregator]: {
    name: "Aggregator",
    key: ValuationType.Aggregator,
  },
  [ValuationType.ERC20]: {
    name: "ERC-20",
    key: ValuationType.ERC20,
  },
  [ValuationType.ERC721]: {
    name: "ERC-721",
    key: ValuationType.ERC721,
  },
  [ValuationType.ERC1155]: {
    name: "ERC-1155",
    key: ValuationType.ERC1155,
  },
};


export const ValuationTypes = Object.values(ValuationTypesMap);
export const ValuationTypeKeys = Object.values(ValuationType);
