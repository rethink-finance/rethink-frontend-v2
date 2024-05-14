import { PositionType } from "~/types/enums/position_type";
import type INAVMethod from "~/types/nav_method";

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
 * Example of the NAV Update entry data from the getNavEntry(index) method:
 *
 * {
 *   "entryType": "0",
 *   "liquid": [
 *     {
 *       "tokenPair": "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827",
 *       "aggregatorAddress": "0x0000000000000000000000000000000000000000",
 *       "functionSignatureWithEncodedInputs": "0x0000000000000000000000000000000000000000",
 *       "assetTokenAddress": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
 *       "nonAssetTokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
 *       "isReturnArray": false,
 *       "returnLength": "0",
 *       "returnIndex": "0",
 *       "pastNAVUpdateIndex": "0"
 *     }
 *   ],
 *   "illiquid": [
 *     {
 *       "baseCurrencySpent": "31250000000000000000000000000000",
 *       "amountAquiredTokens": "0",
 *       "tokenAddress": "0xFE35f402824428e8cc7Ca3f39DdC41799e94c77A",
 *       "isNFT": false,
 *       "otcTxHashes": [
 *         "0x16262288fd6cef68762c4b0c9b3e2d6d7bdb6bd8952b209fe8a62c1b08ac4b36"
 *       ],
 *       "nftType": "0",
 *       "nftIndex": "1",
 *       "pastNAVUpdateIndex": "0"
 *     }
 *   ],
 *   "nft": [],
 *   "composable": [],
 *   "isPastNAVUpdate": false,
 *   "pastNAVUpdateIndex": "0",
 *   "pastNAVUpdateEntryIndex": "0",
 *   "description": ""
 * }
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
  entries: INAVMethod[],
}
