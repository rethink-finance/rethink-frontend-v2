// Example NAV method JSON.
const rawNavMethodJson = `{
    "0": "3n",
    "1": [],
    "2": [],
    "3": [],
    "4": [
      {
        "0": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
        "1": "balanceOf(address)",
        "2": "0x70a08231000000000000000000000000fcf577a1b4364a55af6c48804c8ff4a8463d7dc0",
        "3": "18n",
        "4": false,
        "5": "0n",
        "6": "0n",
        "7": "0n",
        "8": "0n",
        "9": false,
        "__length__": 10,
        "remoteContractAddress": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
        "functionSignatures": "balanceOf(address)",
        "encodedFunctionSignatureWithInputs": "0x70a08231000000000000000000000000fcf577a1b4364a55af6c48804c8ff4a8463d7dc0",
        "normalizationDecimals": "18n",
        "isReturnArray": false,
        "returnValIndex": "0n",
        "returnArraySize": "0n",
        "returnValType": "0n",
        "pastNAVUpdateIndex": "0n",
        "isNegative": false
      }
    ],
    "5": false,
    "6": "0n",
    "7": "0n",
    "8": "{\\"positionName\\":\\"aDAI\\",\\"valuationSource\\":\\"AAVE\\"}",
    "__length__": 9,
    "entryType": "3n",
    "liquid": [],
    "illiquid": [],
    "nft": [],
    "composable": [
      {
        "0": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
        "1": "balanceOf(address)",
        "2": "0x70a08231000000000000000000000000fcf577a1b4364a55af6c48804c8ff4a8463d7dc0",
        "3": "18n",
        "4": false,
        "5": "0n",
        "6": "0n",
        "7": "0n",
        "8": "0n",
        "9": false,
        "__length__": 10,
        "remoteContractAddress": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
        "functionSignatures": "balanceOf(address)",
        "encodedFunctionSignatureWithInputs": "0x70a08231000000000000000000000000fcf577a1b4364a55af6c48804c8ff4a8463d7dc0",
        "normalizationDecimals": "18n",
        "isReturnArray": false,
        "returnValIndex": "0n",
        "returnArraySize": "0n",
        "returnValType": "0n",
        "pastNAVUpdateIndex": "0n",
        "isNegative": false
      }
    ],
    "isPastNAVUpdate": false,
    "pastNAVUpdateIndex": "0n",
    "pastNAVUpdateEntryIndex": "0n",
    "description": "{\\"positionName\\":\\"aDAI\\",\\"valuationSource\\":\\"AAVE\\"}"
  }`;

// This should be the expected details parsing result.
const cleanedNavMethodDetailsJson = `{
  "entryType": "3n",
  "liquid": [],
  "illiquid": [],
  "nft": [],
  "composable": [
    {
      "remoteContractAddress": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
      "functionSignatures": "balanceOf(address)",
      "encodedFunctionSignatureWithInputs": "0x70a08231000000000000000000000000fcf577a1b4364a55af6c48804c8ff4a8463d7dc0",
      "normalizationDecimals": "18n",
      "isReturnArray": false,
      "returnValIndex": "0n",
      "returnArraySize": "0n",
      "returnValType": "0n",
      "pastNAVUpdateIndex": "0n",
      "isNegative": false
    }
  ],
  "isPastNAVUpdate": false,
  "pastNAVUpdateIndex": "0n",
  "pastNAVUpdateEntryIndex": "0n",
  "description": "{\\"positionName\\":\\"aDAI\\",\\"valuationSource\\":\\"AAVE\\"}"
}`;

export const formattedCleanedNavMethodDetailsJson = `{
  "composable": [
    {
      "encodedFunctionSignatureWithInputs": "0x70a08231000000000000000000000000fcf577a1b4364a55af6c48804c8ff4a8463d7dc0",
      "functionSignatures": "balanceOf(address)",
      "isNegative": false,
      "isReturnArray": false,
      "normalizationDecimals": "18n",
      "pastNAVUpdateIndex": "0n",
      "remoteContractAddress": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
      "returnArraySize": "0n",
      "returnValIndex": "0n",
      "returnValType": "0n"
    }
  ],
  "description": "{\\"positionName\\":\\"aDAI\\",\\"valuationSource\\":\\"AAVE\\"}",
  "entryType": "3n",
  "illiquid": [],
  "isPastNAVUpdate": false,
  "liquid": [],
  "nft": [],
  "pastNAVUpdateEntryIndex": "0n",
  "pastNAVUpdateIndex": "0n"
}`;

export const rawNavMethod = JSON.parse(rawNavMethodJson);
export const cleanedNavMethodDetails = JSON.parse(cleanedNavMethodDetailsJson);
