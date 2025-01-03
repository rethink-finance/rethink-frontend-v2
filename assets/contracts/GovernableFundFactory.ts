export const GovernableFundFactory = {
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
          ],
          "internalType": "struct IGovernableFund.Settings",
          "name": "fundSettings",
          "type": "tuple",
        },
      ],
      "name": "createFund",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "governor",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fund",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "safeProxyFactory",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "safeSingleton",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "safeFallbackHandler",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "wrappedTokenFactory",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "navCalculatorAddress",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "zodiacRolesModifierModule",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fundDelgateCallFlowSingletonAddress",
          "type": "address",
        },
        {
          "internalType": "address",
          "name": "fundDelgateCallNavSingletonAddress",
          "type": "address",
        },
      ],
      "name": "initialize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
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
      "name": "registeredFunds",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "",
          "type": "address[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
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
      "name": "registeredFundsData",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "",
          "type": "address[]",
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
          ],
          "internalType": "struct IGovernableFund.Settings[]",
          "name": "",
          "type": "tuple[]",
        },
      ],
      "stateMutability": "view",
      "type": "function",
    },
    {
      "inputs": [],
      "name": "registeredFundsLength",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256",
        },
      ],
      "stateMutability": "view",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "bytes[]",
          "name": "calldatas",
          "type": "bytes[]",
        },
      ],
      "name": "submitPermissions",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "deployer",
          "type": "address",
        },
      ],
      "name": "getFundInitializationCache",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "fundContractAddr",
              "type": "address",
            },
            {
              "internalType": "address",
              "name": "rolesModifier",
              "type": "address",
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
          "internalType": "struct GovernableFundFactory.InitializationCache",
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
              "name": "quorumFraction",
              "type": "uint256",
            },
            {
              "internalType": "uint256",
              "name": "lateQuorum",
              "type": "uint256",
            },
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
          ],
          "internalType": "struct GovernableFundFactory.GovernorParams",
          "name": "governorSettings",
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
      "name": "initCreateFund",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address",
        },
      ],
      "stateMutability": "nonpayable",
      "type": "function",
    },
  ],
} as const;
