import { PositionType } from "~/types/enums/position_type";

export default interface INAVUpdate {
  date: string;
  totalNAV: bigint;
  details: {
    [PositionType.Liquid]: bigint;
    [PositionType.Illiquid]: bigint;
    [PositionType.Composable]: bigint;
    [PositionType.NFT]: bigint;
  };
}
