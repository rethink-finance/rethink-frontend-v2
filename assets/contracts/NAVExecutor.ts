export const NAVExecutor = {
  "abi": [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "oiv",
          "type": "address",
        },
        {
          "internalType": "bytes",
          "name": "data",
          "type": "bytes",
        },
      ],
      "name": "storeNAVData",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function",
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "oiv",
          "type": "address",
        },
      ],
      "name": "getNAVData",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes",
        },
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true,
    },
  ],
} as const;
