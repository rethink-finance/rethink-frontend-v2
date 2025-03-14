export const NAVCalculator = {
  "abi": [
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "remoteContractAddress",
              "type": "address",
            },
            {
              "internalType": "string",
              "name": "functionSignatures",
              "type": "string",
            },
            {
              "internalType": "bytes",
              "name": "encodedFunctionSignatureWithInputs",
              "type": "bytes",
            },
            {
              "internalType": "uint256",
              "name": "normalizationDecimals",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isReturnArray",
              "type": "bool",
            },
            {
              "internalType": "uint256",
              "name": "returnValIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "returnArraySize",
              "type": "uint256",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVComposableUpdateReturnType",
              "name": "returnValType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isNegative",
              "type": "bool",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVComposableUpdate[]",
          "name": "composable",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "composableCalculation",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "remoteContractAddress",
              "type": "address",
            },
            {
              "internalType": "string",
              "name": "functionSignatures",
              "type": "string",
            },
            {
              "internalType": "bytes",
              "name": "encodedFunctionSignatureWithInputs",
              "type": "bytes",
            },
            {
              "internalType": "uint256",
              "name": "normalizationDecimals",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isReturnArray",
              "type": "bool",
            },
            {
              "internalType": "uint256",
              "name": "returnValIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "returnArraySize",
              "type": "uint256",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVComposableUpdateReturnType",
              "name": "returnValType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isNegative",
              "type": "bool",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVComposableUpdate[]",
          "name": "composable",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "gff",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "deployer",
          "type": "address",
        },
      ],
      "name": "composableCalculationNonInitReadOnly",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "remoteContractAddress",
              "type": "address",
            },
            {
              "internalType": "string",
              "name": "functionSignatures",
              "type": "string",
            },
            {
              "internalType": "bytes",
              "name": "encodedFunctionSignatureWithInputs",
              "type": "bytes",
            },
            {
              "internalType": "uint256",
              "name": "normalizationDecimals",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isReturnArray",
              "type": "bool",
            },
            {
              "internalType": "uint256",
              "name": "returnValIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "returnArraySize",
              "type": "uint256",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVComposableUpdateReturnType",
              "name": "returnValType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isNegative",
              "type": "bool",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVComposableUpdate[]",
          "name": "composable",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "composableCalculationReadOnly",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "baseCurrencySpent",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "amountAquiredTokens",
              "type": "uint256",
            },
            {
              "internalType": "address",
              "name": "tokenAddress",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isNFT",
              "type": "bool",
            },
            {
              "internalType": "string[]",
              "name": "otcTxHashes",
              "type": "string[]",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVNFTType",
              "name": "nftType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "nftIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVIlliquidUpdate[]",
          "name": "illiquid",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "illiquidCalculation",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "baseCurrencySpent",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "amountAquiredTokens",
              "type": "uint256",
            },
            {
              "internalType": "address",
              "name": "tokenAddress",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isNFT",
              "type": "bool",
            },
            {
              "internalType": "string[]",
              "name": "otcTxHashes",
              "type": "string[]",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVNFTType",
              "name": "nftType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "nftIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVIlliquidUpdate[]",
          "name": "illiquid",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "illiquidCalculationReadOnly",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "tokenPair",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "aggregatorAddress",
              "type": "address",
            },
            {
              "internalType": "bytes",
              "name": "functionSignatureWithEncodedInputs",
              "type": "bytes",
            },
            {
              "internalType": "address",
              "name": "assetTokenAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "nonAssetTokenAddress",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isReturnArray",
              "type": "bool",
            },
            {
              "internalType": "uint256",
              "name": "returnLength",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "returnIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVLiquidUpdate[]",
          "name": "liquid",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "liquidCalculation",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "tokenPair",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "aggregatorAddress",
              "type": "address",
            },
            {
              "internalType": "bytes",
              "name": "functionSignatureWithEncodedInputs",
              "type": "bytes",
            },
            {
              "internalType": "address",
              "name": "assetTokenAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "nonAssetTokenAddress",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isReturnArray",
              "type": "bool",
            },
            {
              "internalType": "uint256",
              "name": "returnLength",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "returnIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVLiquidUpdate[]",
          "name": "liquid",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "liquidCalculationReadOnly",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "oracleAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "nftAddress",
              "type": "address",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVNFTType",
              "name": "nftType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "nftIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVNFTUpdate[]",
          "name": "nft",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "nftCalculation",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "oracleAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "nftAddress",
              "type": "address",
            },
            {
              "internalType": "enum IGovernableFundStorage.NAVNFTType",
              "name": "nftType",
              "type": "uint8",
            },
            {
              "internalType": "uint256",
              "name": "nftIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "pastNAVUpdateIndex",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NAVNFTUpdate[]",
          "name": "nft",
          "type": "tuple[]",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "bool",
          "name": "isPastNAVUpdate",
          "type": "bool",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateIndex",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "pastNAVUpdateEntryIndex",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address",
        },
      ],
      "name": "nftCalculationReadOnly",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "uint256[]",
          "name": "data",
          "type": "uint256[]",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
      ],
      "name": "cacheNAVParts",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
      ],
      "name": "getNAVIlliquidCache",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
      ],
      "name": "getNAVLiquidCache",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
      ],
      "name": "getNAVComposableCache",
      "outputs": [
        {
          "internalType": "int256[]",
          "name": "",
          "type": "int256[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
      ],
      "name": "getNAVNFTCache",
      "outputs": [
        {
          "internalType": "int256[]",
          "name": "",
          "type": "int256[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "navEntryIndex",
          "type": "uint256",
        },
      ],
      "name": "getNAVParts",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "baseAssetOIVBal",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "baseAssetSafeBal",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feeBal",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "totalNAV",
              "type": "uint256",
            },
          ],
          "internalType": "struct NAVCalculator.NAVInternalCacheType",
          "name": "",
          "type": "tuple",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
  ],
} as const;
