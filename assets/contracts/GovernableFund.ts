export const GovernableFund = {
  "abi": [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor",
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address",
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "spender",
          "type": "address",
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256",
        },
      ],
      "name": "Approval",
      "type": "event",
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "delegator",
          "type": "address",
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "fromDelegate",
          "type": "address",
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "toDelegate",
          "type": "address",
        },
      ],
      "name": "DelegateChanged",
      "type": "event",
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "delegate",
          "type": "address",
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "previousBalance",
          "type": "uint256",
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "newBalance",
          "type": "uint256",
        },
      ],
      "name": "DelegateVotesChanged",
      "type": "event",
    },
    {
      "anonymous": false,
      "inputs": [],
      "name": "EIP712DomainChanged",
      "type": "event",
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint8",
          "name": "version",
          "type": "uint8",
        },
      ],
      "name": "Initialized",
      "type": "event",
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address",
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address",
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256",
        },
      ],
      "name": "Transfer",
      "type": "event",
    },
    {
      "inputs": [],
      "name": "DOMAIN_SEPARATOR",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "FundSettings",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "depositFee",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "withdrawFee",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "performanceFee",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "managementFee",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "performaceHurdleRateBps",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "baseToken",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "safe",
          "type": "address",
        },
        {
          "internalType": "bool",
          "name": "isExternalGovTokenInUse",
          "type": "bool",
        },
        {
          "internalType": "bool",
          "name": "isWhitelistedDeposits",
          "type": "bool",
        },
        {
          "internalType": "address",
          "name": "governanceToken",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fundAddress",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "governor",
          "type": "address",
        },
        {
          "internalType": "string",
          "name": "fundName",
          "type": "string",
        },
        {
          "internalType": "string",
          "name": "fundSymbol",
          "type": "string",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "_feeBal",
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
      "inputs": [],
      "name": "_navUpdateLatestIndex",
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
      "inputs": [],
      "name": "_navUpdateLatestTime",
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
      "inputs": [],
      "name": "_totalDepositBal",
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
          "internalType": "address",
          "name": "owner",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "spender",
          "type": "address",
        },
      ],
      "name": "allowance",
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
          "internalType": "address",
          "name": "spender",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256",
        },
      ],
      "name": "approve",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address",
        },
      ],
      "name": "balanceOf",
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
          "internalType": "address",
          "name": "account",
          "type": "address",
        },
        {
          "internalType": "uint32",
          "name": "pos",
          "type": "uint32",
        },
      ],
      "name": "checkpoints",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint32",
              "name": "fromBlock",
              "type": "uint32",
            },
            {
              "internalType": "uint224",
              "name": "votes",
              "type": "uint224",
            },
          ],
          "internalType": "struct ERC20VotesUpgradeable.Checkpoint",
          "name": "",
          "type": "tuple",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8",
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
          "name": "spender",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "subtractedValue",
          "type": "uint256",
        },
      ],
      "name": "decreaseAllowance",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "delegatee",
          "type": "address",
        },
      ],
      "name": "delegate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "delegatee",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "nonce",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "expiry",
          "type": "uint256",
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8",
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32",
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32",
        },
      ],
      "name": "delegateBySig",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address",
        },
      ],
      "name": "delegates",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "eip712Domain",
      "outputs": [
        {
          "internalType": "bytes1",
          "name": "fields",
          "type": "bytes1",
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string",
        },
        {
          "internalType": "string",
          "name": "version",
          "type": "string",
        },
        {
          "internalType": "uint256",
          "name": "chainId",
          "type": "uint256",
        },
        {
          "internalType": "address",
          "name": "verifyingContract",
          "type": "address",
        },
        {
          "internalType": "bytes32",
          "name": "salt",
          "type": "bytes32",
        },
        {
          "internalType": "uint256[]",
          "name": "extensions",
          "type": "uint256[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "feeManagePeriod",
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
      "inputs": [],
      "name": "feePerformancePeriod",
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
      "inputs": [],
      "name": "fundMetadata",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "getCurrentPendingDepositBal",
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
      "inputs": [],
      "name": "getCurrentPendingWithdrawalBal",
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
          "internalType": "enum IGovernableFundStorage.FundFeeType",
          "name": "feeType",
          "type": "uint8",
        },
      ],
      "name": "getFeeCollector",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "getFundSettings",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "depositFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "withdrawFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "performanceFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "managementFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "performaceHurdleRateBps",
              "type": "uint256",
            },
            {
              "internalType": "address",
              "name": "baseToken",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "safe",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isExternalGovTokenInUse",
              "type": "bool",
            },
            {
              "internalType": "bool",
              "name": "isWhitelistedDeposits",
              "type": "bool",
            },
            {
              "internalType": "address[]",
              "name": "allowedDepositAddrs",
              "type": "address[]",
            },
            {
              "internalType": "address[]",
              "name": "allowedManagers",
              "type": "address[]",
            },
            {
              "internalType": "address",
              "name": "governanceToken",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "fundAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "governor",
              "type": "address",
            },
            {
              "internalType": "string",
              "name": "fundName",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundSymbol",
              "type": "string",
            },
            {
              "internalType": "address[4]",
              "name": "feeCollectors",
              "type": "address[4]",
            },
          ],
          "internalType": "struct IGovernableFundStorage.Settings",
          "name": "",
          "type": "tuple",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "getFundStartTime",
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
          "internalType": "uint256",
          "name": "index",
          "type": "uint256",
        },
      ],
      "name": "getNavEntry",
      "outputs": [
        {
          "components": [
            {
              "internalType": "enum IGovernableFundStorage.NavUpdateType",
              "name": "entryType",
              "type": "uint8",
            },
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
              "internalType": "string",
              "name": "description",
              "type": "string",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NavUpdateEntry[]",
          "name": "",
          "type": "tuple[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "start",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "end",
          "type": "uint256",
        },
      ],
      "name": "getNavUpdateTime",
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
          "internalType": "uint256",
          "name": "timepoint",
          "type": "uint256",
        },
      ],
      "name": "getPastTotalSupply",
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
          "internalType": "address",
          "name": "account",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "timepoint",
          "type": "uint256",
        },
      ],
      "name": "getPastVotes",
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
          "internalType": "address",
          "name": "account",
          "type": "address",
        },
      ],
      "name": "getVotes",
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
          "internalType": "address",
          "name": "spender",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "addedValue",
          "type": "uint256",
        },
      ],
      "name": "increaseAllowance",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string",
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
          "name": "owner",
          "type": "address",
        },
      ],
      "name": "nonces",
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
          "internalType": "address",
          "name": "account",
          "type": "address",
        },
      ],
      "name": "numCheckpoints",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32",
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
          "name": "owner",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "spender",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256",
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8",
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32",
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32",
        },
      ],
      "name": "permit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "totalSupply",
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
          "internalType": "address",
          "name": "to",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256",
        },
      ],
      "name": "transfer",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address",
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256",
        },
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name_",
          "type": "string",
        },
        {
          "internalType": "string",
          "name": "_symbol_",
          "type": "string",
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "depositFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "withdrawFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "performanceFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "managementFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "performaceHurdleRateBps",
              "type": "uint256",
            },
            {
              "internalType": "address",
              "name": "baseToken",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "safe",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isExternalGovTokenInUse",
              "type": "bool",
            },
            {
              "internalType": "bool",
              "name": "isWhitelistedDeposits",
              "type": "bool",
            },
            {
              "internalType": "address[]",
              "name": "allowedDepositAddrs",
              "type": "address[]",
            },
            {
              "internalType": "address[]",
              "name": "allowedManagers",
              "type": "address[]",
            },
            {
              "internalType": "address",
              "name": "governanceToken",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "fundAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "governor",
              "type": "address",
            },
            {
              "internalType": "string",
              "name": "fundName",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundSymbol",
              "type": "string",
            },
            {
              "internalType": "address[4]",
              "name": "feeCollectors",
              "type": "address[4]",
            },
          ],
          "internalType": "struct IGovernableFundStorage.Settings",
          "name": "_fundSettings",
          "type": "tuple",
        },
        {
          "internalType": "address",
          "name": "navCalculatorAddress",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fundDelgateCallFlowAddress",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fundDelgateCallNavAddress",
          "type": "address",
        },
        {
          "internalType": "string",
          "name": "_fundMetadata",
          "type": "string",
        },
        {
          "internalType": "uint256",
          "name": "_feePerformancePeriod",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "_feeManagePeriod",
          "type": "uint256",
        },
      ],
      "name": "initialize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [],
      "name": "clock",
      "outputs": [
        {
          "internalType": "uint48",
          "name": "",
          "type": "uint48",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [],
      "name": "CLOCK_MODE",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string",
        },
      ],
      "stateMutability": "pure",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "depositFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "withdrawFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "performanceFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "managementFee",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "performaceHurdleRateBps",
              "type": "uint256",
            },
            {
              "internalType": "address",
              "name": "baseToken",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "safe",
              "type": "address",
            },
            {
              "internalType": "bool",
              "name": "isExternalGovTokenInUse",
              "type": "bool",
            },
            {
              "internalType": "bool",
              "name": "isWhitelistedDeposits",
              "type": "bool",
            },
            {
              "internalType": "address[]",
              "name": "allowedDepositAddrs",
              "type": "address[]",
            },
            {
              "internalType": "address[]",
              "name": "allowedManagers",
              "type": "address[]",
            },
            {
              "internalType": "address",
              "name": "governanceToken",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "fundAddress",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "governor",
              "type": "address",
            },
            {
              "internalType": "string",
              "name": "fundName",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundSymbol",
              "type": "string",
            },
            {
              "internalType": "address[4]",
              "name": "feeCollectors",
              "type": "address[4]",
            },
          ],
          "internalType": "struct IGovernableFundStorage.Settings",
          "name": "_fundSettings",
          "type": "tuple",
        },
        {
          "internalType": "string",
          "name": "_fundMetadata",
          "type": "string",
        },
        {
          "internalType": "uint256",
          "name": "_feePerformancePeriod",
          "type": "uint256",
        },
        {
          "internalType": "uint256",
          "name": "_feeManagePeriod",
          "type": "uint256",
        },
      ],
      "name": "updateSettings",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "enum IGovernableFundStorage.NavUpdateType",
              "name": "entryType",
              "type": "uint8",
            },
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
              "internalType": "string",
              "name": "description",
              "type": "string",
            },
          ],
          "internalType": "struct IGovernableFundStorage.NavUpdateEntry[]",
          "name": "navUpdateData",
          "type": "tuple[]",
        },
        {
          "internalType": "address[]",
          "name": "pastNAVUpdateEntryFundAddress",
          "type": "address[]",
        },
        {
          "internalType": "bool",
          "name": "processWithdraw",
          "type": "bool",
        },
      ],
      "name": "updateNav",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "navExecutor",
          "type": "address",
        },
      ],
      "name": "executeNAVUpdate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "bytes",
          "name": "flowCall",
          "type": "bytes",
        },
      ],
      "name": "fundFlowsCall",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [],
      "name": "totalWithrawalBalance",
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
          "internalType": "uint8",
          "name": "feeKind",
          "type": "uint8",
        },
      ],
      "name": "calculateAccrued",
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
          "internalType": "enum IGovernableFundStorage.FundFeeType",
          "name": "feeType",
          "type": "uint8",
        },
      ],
      "name": "collectFees",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [],
      "name": "toggleDaoFee",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "bps",
          "type": "uint256",
        },
      ],
      "name": "setDaoFeeBps",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "addr",
          "type": "address",
        },
      ],
      "name": "setDaoFeeAddr",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "ownr",
          "type": "address",
        },
      ],
      "name": "valueOf",
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
      "inputs": [],
      "name": "totalNAV",
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
  ],
} as const;
