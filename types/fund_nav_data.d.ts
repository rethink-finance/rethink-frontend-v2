

export default interface IFundNavData {
  latestIndex: bigint;
  totalNav: bigint;
  illiquidLen: bigint;
  liquidLen: bigint;
  nftLen: bigint;
  composableLen: bigint;
  updateTimes: bigint[];
  illiquid: bigint[][];
  liquid: bigint[][];
  nft: bigint[][];
  composable: bigint[][];
  encodedNavUpdate: string[];
  encodedNavParts: string[];
}
