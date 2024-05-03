import { PositionType } from "~/types/enums/position_type";

/**
 * NavEntryKeys = [
 *   "composable",
 *   "description",
 *   "entryType",
 *   "illiquid",
 *   "isPastNAVUpdate",
 *   "liquid",
 *   "nft",
 *   "pastNAVUpdateEntryIndex",
 *   "pastNAVUpdateIndex",
 * ]
 */
export default interface INAVUpdate {
  date: string;
  totalNAV: bigint;
  quantity: {
    [PositionType.Liquid]: bigint;
    [PositionType.Illiquid]: bigint;
    [PositionType.Composable]: bigint;
    [PositionType.NFT]: bigint;
  };
  json: {
    [PositionType.Liquid]: string;
    [PositionType.Illiquid]: string;
    [PositionType.Composable]: string;
    [PositionType.NFT]: string;
  };
}
