import type IDelegator from "./delegator";

export default interface IDelegate {
  address: string;
  delegators: IDelegator[];
  delegatorCount: number;
  votingPower: string;
  votingPowerPercent: string;
}
