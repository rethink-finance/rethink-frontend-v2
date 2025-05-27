export const RethinkReader = {
  "contractName": "RethinkReader",
  "abi": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "governableFundFactory",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "navCalculator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getFundFlowsConfig",
      "inputs": [
        {
          "name": "fund",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct IGovernableFundStorage.FlowsConfig",
          "components": [
            {
              "name": "flowVersion",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "minDeposit",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "maxDeposit",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "minWithdrawal",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "maxWithdrawal",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "limitsEnabled",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getFundMetaData",
      "inputs": [
        {
          "name": "fund",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct RethinkReader.FundMetaData",
          "components": [
            {
              "name": "startTime",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "totalDepositBal",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "feeBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "feePerformancePeriod",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "feeManagePeriod",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundTokenDecimals",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundBaseTokenDecimals",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundGovernanceTokenDecimals",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundTokenSupply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundBaseTokenSupply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundGovernanceTokenSupply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "safeContractBaseTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundContractBaseTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundMetadata",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundName",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundBaseTokenSymbol",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundGovernanceTokenSymbol",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundGovernanceData",
              "type": "tuple",
              "internalType": "struct RethinkReader.FundGovernanceData",
              "components": [
                {
                  "name": "votingDelay",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "votingPeriod",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "proposalThreshold",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "lateQuorumVoteExtension",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "quorumNumerator",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "quorumDenominator",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "clockMode",
                  "type": "string",
                  "internalType": "string"
                }
              ]
            },
            {
              "name": "fundSettings",
              "type": "tuple",
              "internalType": "struct IGovernableFundStorage.Settings",
              "components": [
                {
                  "name": "depositFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "withdrawFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "performanceFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "managementFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "performaceHurdleRateBps",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "baseToken",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "safe",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "isExternalGovTokenInUse",
                  "type": "bool",
                  "internalType": "bool"
                },
                {
                  "name": "isWhitelistedDeposits",
                  "type": "bool",
                  "internalType": "bool"
                },
                {
                  "name": "allowedDepositAddrs",
                  "type": "address[]",
                  "internalType": "address[]"
                },
                {
                  "name": "allowedManagers",
                  "type": "address[]",
                  "internalType": "address[]"
                },
                {
                  "name": "governanceToken",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "fundAddress",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "governor",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "fundName",
                  "type": "string",
                  "internalType": "string"
                },
                {
                  "name": "fundSymbol",
                  "type": "string",
                  "internalType": "string"
                },
                {
                  "name": "feeCollectors",
                  "type": "address[4]",
                  "internalType": "address[4]"
                }
              ]
            },
            {
              "name": "flowsConfig",
              "type": "tuple",
              "internalType": "struct IGovernableFundStorage.FlowsConfig",
              "components": [
                {
                  "name": "flowVersion",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "minDeposit",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "maxDeposit",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "minWithdrawal",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "maxWithdrawal",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "limitsEnabled",
                  "type": "bool",
                  "internalType": "bool"
                }
              ]
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getFundNAVData",
      "inputs": [
        {
          "name": "fund",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct RethinkReader.FundNavData",
          "components": [
            {
              "name": "latestIndex",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "updateTimes",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "encodedNavUpdate",
              "type": "bytes[]",
              "internalType": "bytes[]"
            },
            {
              "name": "encodedNavParts",
              "type": "bytes[]",
              "internalType": "bytes[]"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getFundUserData",
      "inputs": [
        {
          "name": "fund",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct RethinkReader.FundUserData",
          "components": [
            {
              "name": "baseTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "governanceTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundAllowance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundShareValue",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundDelegateAddress",
              "type": "address",
              "internalType": "address"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getFundsMetaData",
      "inputs": [
        {
          "name": "funds",
          "type": "address[]",
          "internalType": "address[]"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct RethinkReader.FundMetaData[]",
          "components": [
            {
              "name": "startTime",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "totalDepositBal",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "feeBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "feePerformancePeriod",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "feeManagePeriod",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundTokenDecimals",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundBaseTokenDecimals",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundGovernanceTokenDecimals",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundTokenSupply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundBaseTokenSupply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundGovernanceTokenSupply",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "safeContractBaseTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundContractBaseTokenBalance",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "fundMetadata",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundName",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundBaseTokenSymbol",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundGovernanceTokenSymbol",
              "type": "string",
              "internalType": "string"
            },
            {
              "name": "fundGovernanceData",
              "type": "tuple",
              "internalType": "struct RethinkReader.FundGovernanceData",
              "components": [
                {
                  "name": "votingDelay",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "votingPeriod",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "proposalThreshold",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "lateQuorumVoteExtension",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "quorumNumerator",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "quorumDenominator",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "clockMode",
                  "type": "string",
                  "internalType": "string"
                }
              ]
            },
            {
              "name": "fundSettings",
              "type": "tuple",
              "internalType": "struct IGovernableFundStorage.Settings",
              "components": [
                {
                  "name": "depositFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "withdrawFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "performanceFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "managementFee",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "performaceHurdleRateBps",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "baseToken",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "safe",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "isExternalGovTokenInUse",
                  "type": "bool",
                  "internalType": "bool"
                },
                {
                  "name": "isWhitelistedDeposits",
                  "type": "bool",
                  "internalType": "bool"
                },
                {
                  "name": "allowedDepositAddrs",
                  "type": "address[]",
                  "internalType": "address[]"
                },
                {
                  "name": "allowedManagers",
                  "type": "address[]",
                  "internalType": "address[]"
                },
                {
                  "name": "governanceToken",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "fundAddress",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "governor",
                  "type": "address",
                  "internalType": "address"
                },
                {
                  "name": "fundName",
                  "type": "string",
                  "internalType": "string"
                },
                {
                  "name": "fundSymbol",
                  "type": "string",
                  "internalType": "string"
                },
                {
                  "name": "feeCollectors",
                  "type": "address[4]",
                  "internalType": "address[4]"
                }
              ]
            },
            {
              "name": "flowsConfig",
              "type": "tuple",
              "internalType": "struct IGovernableFundStorage.FlowsConfig",
              "components": [
                {
                  "name": "flowVersion",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "minDeposit",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "maxDeposit",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "minWithdrawal",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "maxWithdrawal",
                  "type": "uint256",
                  "internalType": "uint256"
                },
                {
                  "name": "limitsEnabled",
                  "type": "bool",
                  "internalType": "bool"
                }
              ]
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getFundsNAVData",
      "inputs": [
        {
          "name": "funds",
          "type": "address[]",
          "internalType": "address[]"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct RethinkReader.FundNavData[]",
          "components": [
            {
              "name": "latestIndex",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "updateTimes",
              "type": "uint256[]",
              "internalType": "uint256[]"
            },
            {
              "name": "encodedNavUpdate",
              "type": "bytes[]",
              "internalType": "bytes[]"
            },
            {
              "name": "encodedNavParts",
              "type": "bytes[]",
              "internalType": "bytes[]"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "multiStaticCall",
      "inputs": [
        {
          "name": "targets",
          "type": "address[]",
          "internalType": "address[]"
        },
        {
          "name": "_cd",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "stateMutability": "view"
    }
  ],
} as const;
