import type { IPositionType } from "~/types/position_type";

export enum PositionType {
  Liquid = "liquid",
  Composable = "composable",
  NFT = "nft",
  Illiquid = "illiquid"
}
export const PositionTypesMap: Record<string, IPositionType> = {
  [PositionType.Liquid]: {
    name: "Liquid",
    key: PositionType.Liquid,
  },
  [PositionType.Composable]: {
    name: "DeFi",
    key: PositionType.Composable,
  },
  [PositionType.NFT]: {
    name: "NFT",
    key: PositionType.NFT,
  },
  [PositionType.Illiquid]: {
    name: "Illiquid",
    key: PositionType.Illiquid,
  },
};

export const PositionTypes = Object.values(PositionTypesMap);
export const PositionTypeKeys = Object.values(PositionType);
