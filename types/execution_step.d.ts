export interface IExecutionEntry {
  rawTxData: string;
  gasToSendWithTransaction: string;
  addressOfContractInteraction: string;
  operation: string;

  // Optional
  proposalTitle?: string;
  proposalDescription?: string;
}
