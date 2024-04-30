import type { IPositionType } from "~/types/position_type";

export enum PositionType {
  Liquid = "liquid",
  Composable = "composable",
  NFT = "nft",
  Illiquid = "illiquid"
}
export const PositionTypesMap: Record<string, IPositionType> = {
  [PositionType.Liquid]: {
    name: "NAV Liquid",
    key: PositionType.Liquid,
  },
  [PositionType.Composable]: {
    name: "NAV DeFi",
    key: PositionType.Composable,
  },
  [PositionType.NFT]: {
    name: "NAV NFT",
    key: PositionType.NFT,
  },
  [PositionType.Illiquid]: {
    name: "NAV Illiquid",
    key: PositionType.Illiquid,
  },
};

export const PositionTypes = Object.entries(PositionTypesMap);
