import { PositionType } from "~/types/enums/position_type";


/**
  * Example of one entry data that gets stored in the detailsJson field:
  *    {
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
 */
export default interface INAVMethod {
  positionType: PositionType,
  positionName: string,
  valuationSource: string,
  detailsJson: string,
}
