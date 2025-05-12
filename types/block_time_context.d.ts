export default interface BlockTimeContext {
  chainId: ChainId,
  currentBlock: number;
  currentBlockTimestamp: number;
  averageBlockTime: number;
}
