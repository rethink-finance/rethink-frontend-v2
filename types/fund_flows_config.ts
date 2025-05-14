export default interface IFundFlowsConfig {
  useLegacyFlows?: boolean;
  flowVersion: bigint;
  limitsEnabled: boolean;
  minDeposit: string; // comes as bigint, but we convert to string for the form input
  maxDeposit: string; // comes as bigint, but we convert to string for the form input
  minWithdrawal: string; // comes as bigint, but we convert to string for the form input
  maxWithdrawal: string; // comes as bigint, but we convert to string for the form input
}
