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
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "flowVersion",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "minDeposit",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "maxDeposit",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "minWithdrawal",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "maxWithdrawal",
                  "type": "uint256",
                },
                {
                  "internalType": "bool",
                  "name": "limitsEnabled",
                  "type": "bool",
                },
              ],
              "internalType": "struct IGovernableFundStorage.FlowsConfig",
              "name": "flowsConfig",
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
              "internalType": "uint256[]",
              "name": "updateTimes",
              "type": "uint256[]",
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
            {
              "components": [
                {
                  "internalType": "uint256",
                  "name": "flowVersion",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "minDeposit",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "maxDeposit",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "minWithdrawal",
                  "type": "uint256",
                },
                {
                  "internalType": "uint256",
                  "name": "maxWithdrawal",
                  "type": "uint256",
                },
                {
                  "internalType": "bool",
                  "name": "limitsEnabled",
                  "type": "bool",
                },
              ],
              "internalType": "struct IGovernableFundStorage.FlowsConfig",
              "name": "flowsConfig",
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
              "internalType": "uint256[]",
              "name": "updateTimes",
              "type": "uint256[]",
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
      "name": "getUserFundTransactionRequests",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "requestTime",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "settlementAmount",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "settlementEpoch",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "totalAmount",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.DepositRequestEntry",
          "name": "depositRequest",
          "type": "tuple",
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "lpTokenRate",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "baseTokenRate",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isSettled",
              "type": "bool",
            },
          ],
          "internalType": "struct IGovernableFundStorage.SettlementRates",
          "name": "depositSettlementRates",
          "type": "tuple",
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "requestTime",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "settlementAmount",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "settlementEpoch",
              "type": "uint256",
            },
          ],
          "internalType": "struct IGovernableFundStorage.WithdrawalRequestEntry",
          "name": "withdrawalRequest",
          "type": "tuple",
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "lpTokenRate",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "baseTokenRate",
              "type": "uint256",
            },
            {
              "internalType": "bool",
              "name": "isSettled",
              "type": "bool",
            },
          ],
          "internalType": "struct IGovernableFundStorage.SettlementRates",
          "name": "withdrawalSettlementRates",
          "type": "tuple",
        },
      ],
      "stateMutability": "view",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address[]",
          "name": "targets",
          "type": "address[]",
        },
        {
          "internalType": "bytes[]",
          "name": "_cd",
          "type": "bytes[]",
        },
      ],
      "name": "multiStaticCall",
      "outputs": [
        {
          "internalType": "bytes[]",
          "name": "",
          "type": "bytes[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
    },
  ],
} as const;
