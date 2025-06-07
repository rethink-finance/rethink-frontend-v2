export const GovernableFundFactory = {
  "contractName": "GovernableFundFactory",
  "abi": [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "createFund",
      "inputs": [
        {
          "name": "fundSettings",
          "type": "tuple",
          "internalType": "struct IGovernableFundStorage.Settings",
          "components": [
            {
              "name": "depositFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "withdrawFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "performanceFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "managementFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "performaceHurdleRateBps",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "baseToken",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "safe",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "isExternalGovTokenInUse",
              "type": "bool",
              "internalType": "bool",
            },
            {
              "name": "isWhitelistedDeposits",
              "type": "bool",
              "internalType": "bool",
            },
            {
              "name": "allowedDepositAddrs",
              "type": "address[]",
              "internalType": "address[]",
            },
            {
              "name": "allowedManagers",
              "type": "address[]",
              "internalType": "address[]",
            },
            {
              "name": "governanceToken",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundAddress",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "governor",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundName",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "fundSymbol",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "feeCollectors",
              "type": "address[4]",
              "internalType": "address[4]",
            },
          ],
        },
        {
          "name": "governorSettings",
          "type": "tuple",
          "internalType": "struct GovernableFundFactory.GovernorParams",
          "components": [
            {
              "name": "quorumFraction",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "lateQuorum",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "votingDelay",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "votingPeriod",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "proposalThreshold",
              "type": "uint256",
              "internalType": "uint256",
            },
          ],
        },
        {
          "name": "_fundMetadata",
          "type": "string",
          "internalType": "string",
        },
        {
          "name": "_feePerformancePeriod",
          "type": "uint256",
          "internalType": "uint256",
        },
        {
          "name": "_feeManagePeriod",
          "type": "uint256",
          "internalType": "uint256",
        },
        {
          "name": "_flowsConfig",
          "type": "tuple",
          "internalType": "struct IGovernableFundStorage.FlowsConfig",
          "components": [
            {
              "name": "flowVersion",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "minDeposit",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "maxDeposit",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "minWithdrawal",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "maxWithdrawal",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "limitsEnabled",
              "type": "bool",
              "internalType": "bool",
            },
          ],
        },
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address",
        },
      ],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "finalizeCreateFund",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address",
        },
      ],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "getFundInitializationCache",
      "inputs": [
        {
          "name": "deployer",
          "type": "address",
          "internalType": "address",
        },
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct GovernableFundFactory.InitializationCache",
          "components": [
            {
              "name": "fundContractAddr",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "rolesModifier",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundSettings",
              "type": "tuple",
              "internalType": "struct IGovernableFundStorage.Settings",
              "components": [
                {
                  "name": "depositFee",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "withdrawFee",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "performanceFee",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "managementFee",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "performaceHurdleRateBps",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "baseToken",
                  "type": "address",
                  "internalType": "address",
                },
                {
                  "name": "safe",
                  "type": "address",
                  "internalType": "address",
                },
                {
                  "name": "isExternalGovTokenInUse",
                  "type": "bool",
                  "internalType": "bool",
                },
                {
                  "name": "isWhitelistedDeposits",
                  "type": "bool",
                  "internalType": "bool",
                },
                {
                  "name": "allowedDepositAddrs",
                  "type": "address[]",
                  "internalType": "address[]",
                },
                {
                  "name": "allowedManagers",
                  "type": "address[]",
                  "internalType": "address[]",
                },
                {
                  "name": "governanceToken",
                  "type": "address",
                  "internalType": "address",
                },
                {
                  "name": "fundAddress",
                  "type": "address",
                  "internalType": "address",
                },
                {
                  "name": "governor",
                  "type": "address",
                  "internalType": "address",
                },
                {
                  "name": "fundName",
                  "type": "string",
                  "internalType": "string",
                },
                {
                  "name": "fundSymbol",
                  "type": "string",
                  "internalType": "string",
                },
                {
                  "name": "feeCollectors",
                  "type": "address[4]",
                  "internalType": "address[4]",
                },
              ],
            },
            {
              "name": "_fundMetadata",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "_feePerformancePeriod",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "_feeManagePeriod",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "flowsConfig",
              "type": "tuple",
              "internalType": "struct IGovernableFundStorage.FlowsConfig",
              "components": [
                {
                  "name": "flowVersion",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "minDeposit",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "maxDeposit",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "minWithdrawal",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "maxWithdrawal",
                  "type": "uint256",
                  "internalType": "uint256",
                },
                {
                  "name": "limitsEnabled",
                  "type": "bool",
                  "internalType": "bool",
                },
              ],
            },
          ],
        },
      ],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "initCreateFund",
      "inputs": [
        {
          "name": "fundSettings",
          "type": "tuple",
          "internalType": "struct IGovernableFundStorage.Settings",
          "components": [
            {
              "name": "depositFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "withdrawFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "performanceFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "managementFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "performaceHurdleRateBps",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "baseToken",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "safe",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "isExternalGovTokenInUse",
              "type": "bool",
              "internalType": "bool",
            },
            {
              "name": "isWhitelistedDeposits",
              "type": "bool",
              "internalType": "bool",
            },
            {
              "name": "allowedDepositAddrs",
              "type": "address[]",
              "internalType": "address[]",
            },
            {
              "name": "allowedManagers",
              "type": "address[]",
              "internalType": "address[]",
            },
            {
              "name": "governanceToken",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundAddress",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "governor",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundName",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "fundSymbol",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "feeCollectors",
              "type": "address[4]",
              "internalType": "address[4]",
            },
          ],
        },
        {
          "name": "governorSettings",
          "type": "tuple",
          "internalType": "struct GovernableFundFactory.GovernorParams",
          "components": [
            {
              "name": "quorumFraction",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "lateQuorum",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "votingDelay",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "votingPeriod",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "proposalThreshold",
              "type": "uint256",
              "internalType": "uint256",
            },
          ],
        },
        {
          "name": "_fundMetadata",
          "type": "string",
          "internalType": "string",
        },
        {
          "name": "_feePerformancePeriod",
          "type": "uint256",
          "internalType": "uint256",
        },
        {
          "name": "_feeManagePeriod",
          "type": "uint256",
          "internalType": "uint256",
        },
        {
          "name": "_flowsConfig",
          "type": "tuple",
          "internalType": "struct IGovernableFundStorage.FlowsConfig",
          "components": [
            {
              "name": "flowVersion",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "minDeposit",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "maxDeposit",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "minWithdrawal",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "maxWithdrawal",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "limitsEnabled",
              "type": "bool",
              "internalType": "bool",
            },
          ],
        },
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address",
        },
      ],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "initialize",
      "inputs": [
        {
          "name": "governor",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "fund",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "safeProxyFactory",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "safeSingleton",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "safeFallbackHandler",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "safeMultisendAddress",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "wrappedTokenFactory",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "navCalculatorAddress",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "zodiacRolesModifierModule",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "fundDelgateCallFlowSingletonAddress",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "fundDelgateCallNavSingletonAddress",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "governableContractFactorySingletonAddress",
          "type": "address",
          "internalType": "address",
        },
      ],
      "outputs": [],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "registeredFundsData",
      "inputs": [
        {
          "name": "start",
          "type": "uint256",
          "internalType": "uint256",
        },
        {
          "name": "end",
          "type": "uint256",
          "internalType": "uint256",
        },
      ],
      "outputs": [
        {
          "name": "",
          "type": "address[]",
          "internalType": "address[]",
        },
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct IGovernableFundStorage.Settings[]",
          "components": [
            {
              "name": "depositFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "withdrawFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "performanceFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "managementFee",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "performaceHurdleRateBps",
              "type": "uint256",
              "internalType": "uint256",
            },
            {
              "name": "baseToken",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "safe",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "isExternalGovTokenInUse",
              "type": "bool",
              "internalType": "bool",
            },
            {
              "name": "isWhitelistedDeposits",
              "type": "bool",
              "internalType": "bool",
            },
            {
              "name": "allowedDepositAddrs",
              "type": "address[]",
              "internalType": "address[]",
            },
            {
              "name": "allowedManagers",
              "type": "address[]",
              "internalType": "address[]",
            },
            {
              "name": "governanceToken",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundAddress",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "governor",
              "type": "address",
              "internalType": "address",
            },
            {
              "name": "fundName",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "fundSymbol",
              "type": "string",
              "internalType": "string",
            },
            {
              "name": "feeCollectors",
              "type": "address[4]",
              "internalType": "address[4]",
            },
          ],
        },
      ],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "registeredFundsLength",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256",
        },
      ],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "storeNAV",
      "inputs": [
        {
          "name": "navExecutorAddr",
          "type": "address",
          "internalType": "address",
        },
        {
          "name": "data",
          "type": "bytes",
          "internalType": "bytes",
        },
      ],
      "outputs": [],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "submitPermissions",
      "inputs": [
        {
          "name": "calldatas",
          "type": "bytes[]",
          "internalType": "bytes[]",
        },
      ],
      "outputs": [],
      "stateMutability": "nonpayable",
    },
    {
      "type": "event",
      "name": "GovernableFundFactory_CreatedAndInitializedFundEvent",
      "inputs": [
        {
          "name": "fundContractAddr",
          "type": "address",
          "indexed": false,
          "internalType": "address",
        },
        {
          "name": "govContractAddr",
          "type": "address",
          "indexed": false,
          "internalType": "address",
        },
        {
          "name": "safeProxyAddr",
          "type": "address",
          "indexed": false,
          "internalType": "address",
        },
        {
          "name": "rolesModifier",
          "type": "address",
          "indexed": false,
          "internalType": "address",
        },
        {
          "name": "governanceToken",
          "type": "address",
          "indexed": false,
          "internalType": "address",
        },
        {
          "name": "fundName",
          "type": "string",
          "indexed": false,
          "internalType": "string",
        },
      ],
      "anonymous": false,
    },
    {
      "type": "event",
      "name": "Initialized",
      "inputs": [
        {
          "name": "version",
          "type": "uint8",
          "indexed": false,
          "internalType": "uint8",
        },
      ],
      "anonymous": false,
    },
  ],
}
