export interface IExecutionStep {
  name: string;
  formTitle: string;
  formText?: string;
  key: string;
}

export interface IExecutionEntry {
  rowTX: string;
  gasToSendWithTransaction: string;
  addressOfContractInteraction: string;
  operations: string;

  // Optional
  proposalTitle?: string;
  proposalDescription?: string;
}
