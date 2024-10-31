import { PositionType } from "~/types/enums/position_type";
import { ValuationType } from "~/types/enums/valuation_type";


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


// Each NAV update has 1 or more NAV entries.
// NAV Method is actually parsed data from NAV Entry, the original navEntry is in the details.
// TODO consider renaming this everywhere to NAV Entry instead of NAV Method
export interface INAVMethodDetails {
  [key in PositionType]: any[],
  [key: string]: any, // This allows for arbitrary key-value pairs
}

export default interface INAVMethod {
  // Index is a location of where in NAV update entries array the method is defined.
  index?: number,
  positionName: string,
  valuationSource: string,
  positionType: PositionType,

  // pastNAVUpdateEntryFundAddress is original if it was found in fetchFundsNAVData
  foundMatchingPastNAVUpdateEntryFundAddress?: boolean,
  pastNAVUpdateEntryFundAddress?: string,
  pastNAVUpdateEntrySafeAddress?: string,
  // NAV value of that NAV method (if it was already executed in the past)
  pastNavValue?: bigint,
  pastNavValueLoading?: boolean,
  pastNavValueError?: boolean,

  // @dev note:
  // It is very important to keep the same structure of the details hash always, as it is used to
  // compare NAV methods by the hashed details value, and any additional key value pair would break it.
  // TODO: Figure out a better way to store details, a fixed typescript structure probably.
  details: INAVMethodDetails,
  // Details JSON are displayed in NAV method table details as raw data formatted JSON string.
  detailsJson: string,
  valuationType: ValuationType,
  deleted?: boolean,  // THis is only used in the frontend, to mark it for deletion when managing NAV methods.
  isNew?: boolean,  // THis is only used in the frontend, to mark it as new when managing NAV methods.
  simulatedNav?: bigint,  // THis is only used in the frontend, when simulating NAV methods.
  isSimulatedNavError?: boolean,
  simulatedNavFormatted?: string,
  // THis is only used in the frontend, as methods don't have any IDs, we hash their contents to compare them.
  // Hash is generated from the detailsJson.
  detailsHash?: string,
}
