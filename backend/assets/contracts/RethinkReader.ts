export const RethinkReader = {
  "contractName": "RethinkReader",
  "abi": [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "governableFundFactory",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "navCalculator",
          "type": "address",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "constructor",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
      ],
      "name": "getFundMetaData",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "startTime",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "totalDepositBal",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feeBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feePerformancePeriod",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feeManagePeriod",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundTokenDecimals",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundBaseTokenDecimals",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundGovernanceTokenDecimals",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundTokenSupply",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundBaseTokenSupply",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundGovernanceTokenSupply",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "safeContractBaseTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundContractBaseTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "string",
              "name": "fundMetadata",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundName",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundBaseTokenSymbol",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundGovernanceTokenSymbol",
              "type": "string",
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "votingDelay",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "votingPeriod",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "proposalThreshold",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "lateQuorumVoteExtension",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "quorumNumerator",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "quorumDenominator",
                  "type": "uint256",
                },
                {
                  "internalType": "string",
                  "name": "clockMode",
                  "type": "string",
                },
              ],
              "internalType": "struct RethinkReader.FundGovernanceData",
              "name": "fundGovernanceData",
              "type": "tuple",
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
              "name": "fundSettings",
              "type": "tuple",
            },
          ],
          "internalType": "struct RethinkReader.FundMetaData",
          "name": "",
          "type": "tuple",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
    {
      "inputs": [
        {
          "internalType": "address[]",
          "name": "funds",
          "type": "address[]",
        },
      ],
      "name": "getFundsMetaData",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "startTime",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "totalDepositBal",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feeBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feePerformancePeriod",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "feeManagePeriod",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundTokenDecimals",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundBaseTokenDecimals",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundGovernanceTokenDecimals",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundTokenSupply",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundBaseTokenSupply",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundGovernanceTokenSupply",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "safeContractBaseTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundContractBaseTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "string",
              "name": "fundMetadata",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundName",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundBaseTokenSymbol",
              "type": "string",
            },
            {
              "internalType": "string",
              "name": "fundGovernanceTokenSymbol",
              "type": "string",
            },
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "votingDelay",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "votingPeriod",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "proposalThreshold",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "lateQuorumVoteExtension",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "quorumNumerator",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "quorumDenominator",
                  "type": "uint256",
                },
                {
                  "internalType": "string",
                  "name": "clockMode",
                  "type": "string",
                },
              ],
              "internalType": "struct RethinkReader.FundGovernanceData",
              "name": "fundGovernanceData",
              "type": "tuple",
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
              "name": "fundSettings",
              "type": "tuple",
            },
          ],
          "internalType": "struct RethinkReader.FundMetaData[]",
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
          "internalType": "address[]",
          "name": "funds",
          "type": "address[]",
        },
      ],
      "name": "getFundsNAVData",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "latestIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "totalNav",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "illiquidLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "liquidLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "nftLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "composableLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256[]",
              "name": "updateTimes",
              "type": "uint256[]",
            },
            {
              "internalType": "uint256[][]",
              "name": "illiquid",
              "type": "uint256[][]",
            },
            {
              "internalType": "uint256[][]",
              "name": "liquid",
              "type": "uint256[][]",
            },
            {
              "internalType": "int256[][]",
              "name": "nft",
              "type": "int256[][]",
            },
            {
              "internalType": "int256[][]",
              "name": "composable",
              "type": "int256[][]",
            },
            {
              "internalType": "bytes[]",
              "name": "encodedNavUpdate",
              "type": "bytes[]",
            },
            {
              "internalType": "bytes[]",
              "name": "encodedNavParts",
              "type": "bytes[]",
            },
          ],
          "internalType": "struct RethinkReader.FundNavData[]",
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
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
      ],
      "name": "getFundNAVData",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "latestIndex",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "totalNav",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "illiquidLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "liquidLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "nftLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "composableLen",
              "type": "uint256",
            },
            {
              "internalType": "uint256[]",
              "name": "updateTimes",
              "type": "uint256[]",
            },
            {
              "internalType": "uint256[][]",
              "name": "illiquid",
              "type": "uint256[][]",
            },
            {
              "internalType": "uint256[][]",
              "name": "liquid",
              "type": "uint256[][]",
            },
            {
              "internalType": "int256[][]",
              "name": "nft",
              "type": "int256[][]",
            },
            {
              "internalType": "int256[][]",
              "name": "composable",
              "type": "int256[][]",
            },
            {
              "internalType": "bytes[]",
              "name": "encodedNavUpdate",
              "type": "bytes[]",
            },
            {
              "internalType": "bytes[]",
              "name": "encodedNavParts",
              "type": "bytes[]",
            },
          ],
          "internalType": "struct RethinkReader.FundNavData",
          "name": "",
          "type": "tuple",
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
          "internalType": "address",
          "name": "user",
          "type": "address",
        },
      ],
      "name": "getFundUserData",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "baseTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "governanceTokenBalance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundAllowance",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "fundShareValue",
              "type": "uint256",
            },
            {
              "internalType": "address",
              "name": "fundDelegateAddress",
              "type": "address",
            },
          ],
          "internalType": "struct RethinkReader.FundUserData",
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
