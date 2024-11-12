import type Web3 from "web3";

export default interface BlockTimeContext {
  currentBlock: number;
  currentBlockTimestamp: number;
  web3Instance: Web3;
  averageBlockTime: number;
}
