import type { IPositionType } from "../position_type";
import { ValuationType } from "./valuation_type";

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


export const PositionTypes = Object.values(PositionTypesMap);
export const PositionTypeKeys = Object.values(PositionType);


/**
 * Position Type Maps (Dynamic Form Data)
 **/
export const NAVEntryTypeToPositionTypeMap: Record<number, PositionType> = {
  0: PositionType.Liquid, // NAVLiquidUpdateType
  1: PositionType.Illiquid, // NAVIlliquidUpdateType
  2: PositionType.NFT, // NAVNFTUpdateType
  3: PositionType.Composable, // NAVComposableUpdateType
}
export const NAVEntryTypeStringToPositionTypeMap: Record<string, PositionType> = {
  NAVLiquidUpdateType: PositionType.Liquid,
  NAVIlliquidUpdateType: PositionType.Illiquid,
  NAVNFTUpdateType: PositionType.NFT,
  NAVComposableUpdateType: PositionType.Composable,
}
export const NAVEntryTypeStringToNAVEntryTypeMap: Record<string, number> = {
  NAVLiquidUpdateType: 0,
  NAVIlliquidUpdateType: 1,
  NAVNFTUpdateType: 2,
  NAVComposableUpdateType: 3,
}
export const PositionTypeToNAVEntryTypeMap: Record<PositionType, number> = {
  [PositionType.Liquid]: 0, // NAVLiquidUpdateType
  [PositionType.Illiquid]: 1, // NAVIlliquidUpdateType
  [PositionType.NFT]: 2, // NAVNFTUpdateType
  [PositionType.Composable]: 3, // NAVComposableUpdateType
}
export const PositionTypeToNAVCalculationMethod: Record<PositionType, string> = {
  [PositionType.Liquid]: "liquidCalculationReadOnly",
  [PositionType.Illiquid]: "illiquidCalculationReadOnly",
  [PositionType.NFT]: "nftCalculationReadOnly",
  [PositionType.Composable]: "composableCalculationReadOnly",
}
export const PositionTypeToNAVCacheMethod: Record<PositionType, string> = {
  [PositionType.Liquid]: "getNAVLiquidCache",
  [PositionType.Illiquid]: "getNAVIlliquidCache",
  [PositionType.NFT]: "getNAVNFTCache",
  [PositionType.Composable]: "getNAVComposableCache",
}
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
