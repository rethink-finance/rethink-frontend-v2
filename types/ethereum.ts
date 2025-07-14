/**
 * Types for Ethereum blockchain interaction
 */
export interface IBaseTransaction {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  value: string; // in wei (as a string to handle large numbers)
  gasPrice: string;
  gasUsed: string;
  isIncoming?: boolean; // true if the transaction is incoming to the wallet address
}
export interface ITransaction extends IBaseTransaction {
  input: string;
}

export interface ITokenTransfer extends IBaseTransaction {
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenContract: string;
}

/** There more fields, example:
  {
    "blockNumber": "344790649",
    "timeStamp": "1749283949",
    "hash": "0xf7a17ad32d3128b87ff9d4a2336efeb7a666a02ca03725c2a1523e1f3b485cc9",
    "nonce": "631",
    "blockHash": "0xafbab05c62414c90703663910e62102e7d4954c1482bb308a868f69badaa1566",
    "transactionIndex": "2",
    "from": "0x6ec175951624e1e1e6367fa3db90a1829e032ec3",
    "to": "0x9b541381ae6304b7cd39310401b2e030307b8dcc",
    "value": "0",
    "gas": "269364",
    "gasPrice": "10000000",
    "gasPriceBid": "10000000",
    "isError": "0",
    "txreceipt_status": "1",
    "input": "0x2656227d00000000000000000000000...",
    "contractAddress": "",
    "cumulativeGasUsed": "317444",
    "gasUsed": "259822",
    "confirmations": "12832842",
    "methodId": "0x2656227d",
    "functionName": "execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash)"
  }
  **/
export interface IExplorerTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  input: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
}

export interface IExplorerTokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
  gasPrice: string;
  gasUsed: string;
}

