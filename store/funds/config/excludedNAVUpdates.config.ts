import { ChainId } from "~/types/enums/chain_id";

export type IExcludeNAVUpdates = Partial<Record<ChainId, Record<string, number[]>>>;

export const excludeNAVUpdateIndexes: IExcludeNAVUpdates = {
  [ChainId.POLYGON]: {},
  [ChainId.ARBITRUM]: {},
  // [ChainId.FRAXTAL]: {},
  [ChainId.ETHEREUM]: {},
  [ChainId.BASE]: {
    "0x533f164d91e3F8169a7043f7094f44af87Fb7CA4": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      69,
    ], // NDFI
  },
};
