import { defineStore } from "pinia";
import { ChainId } from "~/types/enums/chain_id";
import type BlockTimeContext from "~/types/block_time_context";
import { useWeb3Store } from "~/store/web3/web3.store";

interface IState {
  // Store block time data like current block timestamp and number...
  chainBlockTimeContext: Partial<Record<ChainId, BlockTimeContext>>,
}

export const useBlockTimeStore = defineStore({
  id: "blockTimeStore",
  state: (): IState => {
    return {
      chainBlockTimeContext: {},
    };
  },
  getters: {
    web3Store() {
      return useWeb3Store();
    },
  },
  actions: {
    async initializeBlockTimeContext(chainId: ChainId, convertToL1 = true): Promise<BlockTimeContext> {
      const mappedChainId = convertToL1 ? this.web3Store.getL2ToL1ChainId(chainId) : chainId;

      if (this.chainBlockTimeContext[mappedChainId]?.currentBlock) {
      // Return cached values
        return this.chainBlockTimeContext[mappedChainId] as BlockTimeContext;
      }
      console.log("initializeBlockTimeContext currentBlock", mappedChainId);
      const web3Provider = this.web3Store.getWeb3Instance(mappedChainId, convertToL1);

      const currentBlock = await this.web3Store.callWithRetry(
        mappedChainId,
        () => web3Provider.eth.getBlock("latest"),
      );

      const previousBlock = await this.web3Store.callWithRetry(
        mappedChainId,
        () => web3Provider.eth.getBlock(Number(currentBlock.number) - 1000),
      );

      const timeDiff = Number(currentBlock.timestamp) - Number(previousBlock.timestamp);
      const blockDiff = Number(currentBlock.number) - Number(previousBlock.number);
      const averageBlockTime = timeDiff / blockDiff;

      const context: BlockTimeContext = {
        currentBlock: Number(currentBlock.number),
        currentBlockTimestamp: Number(currentBlock.timestamp),
        chainId: mappedChainId,
        averageBlockTime,
      };

      this.chainBlockTimeContext[mappedChainId] = context;
      return context;
    },
    async getTimestampForBlock(targetBlock: number, context: BlockTimeContext): Promise<number> {
      if (!context) throw new Error("BlockTimeContext not initialized");

      const {
        currentBlock,
        currentBlockTimestamp,
        averageBlockTime,
        chainId,
      } = context;

      if (targetBlock <= currentBlock) {
        const web3Provider = this.web3Store.getWeb3Instance(chainId);

        try {
          const block = await this.web3Store.callWithRetry(
            chainId,
            () => web3Provider.eth.getBlock(targetBlock),
          );
          return Number(block?.timestamp || 0);
        } catch (error) {
          console.error(`Error fetching block ${targetBlock}:`, error);
          return 0;
        }
      }

      const blockDiff = targetBlock - currentBlock;
      const secondsUntilTarget = blockDiff * averageBlockTime;
      return currentBlockTimestamp + secondsUntilTarget;
    },
    async getBlockByTimestamp(chainId: ChainId, timestamp: number, averageBlockTime: number) {
      try {
        // const web3Store = useWeb3Store();
        const provider = this.web3Store.chainProviders[chainId]

        const latestBlock = await this.web3Store
          .callWithRetry(
            chainId,
            async () =>
              Number(await provider.eth.getBlockNumber()),
          )
        const latestBlockData = await this.web3Store
          .callWithRetry(
            chainId,
            async () =>
              await provider.eth.getBlock(latestBlock),
          )
        const latestTimestamp = Number(latestBlockData.timestamp);

        const estimatedStartBlock = latestBlock - Math.floor((latestTimestamp - timestamp) / averageBlockTime);


        if (estimatedStartBlock < 0) {
          console.error("Estimated start block is negative", estimatedStartBlock);
          return null;
        }

        if (estimatedStartBlock > latestBlock) {
          console.error("Estimated start block is greater than latest block", estimatedStartBlock, latestBlock);
          return null;
        }

        return estimatedStartBlock;
      } catch (e) {
        console.error("Error getting block by timestamp", e);
        return null;
      }
    },
  },
});
