import type { IPositionType } from "~/types/position_type";
import type IValuationType from "~/types/valuation_type";
import { ValuationType, ValuationTypesMap } from "~/types/enums/valuation_type";

export enum PositionType {
  Liquid = "liquid",
  Composable = "composable",
  NFT = "nft",
  Illiquid = "illiquid"
}
export const PositionTypesMap: Record<PositionType, IPositionType> = {
  [PositionType.Liquid]: {
    name: "Liquid",
    key: PositionType.Liquid,
  },
  [PositionType.Illiquid]: {
    name: "Illiquid",
    key: PositionType.Illiquid,
  },
  [PositionType.NFT]: {
    name: "NFT",
    key: PositionType.NFT,
  },
  [PositionType.Composable]: {
    name: "DeFi",
    key: PositionType.Composable,
  },
};

export const PositionTypeToValuationTypesMap: Record<PositionType, ValuationType[]> = {
  [PositionType.Liquid]: [
    ValuationType.DEXPair,
    ValuationType.Aggregator,
  ],
  [PositionType.Illiquid]: [
    ValuationType.ERC20,
    ValuationType.ERC721,
    ValuationType.ERC1155,
  ],
  [PositionType.NFT]: [
    ValuationType.ERC721,
    ValuationType.ERC1155,
  ],
  [PositionType.Composable]: [],
}

export const PositionTypes = Object.values(PositionTypesMap);
export const PositionTypeKeys = Object.values(PositionType);
