import { defineStore } from "pinia";
import { ChainId } from "~/types/enums/chain_id";
import type BlockTimeContext from "~/types/block_time_context";
import { useWeb3Store } from "~/store/web3/web3.store";

interface IState {
  // Store block time data like current block timestamp and number...
  chainBlockTimeContext: Partial<Record<ChainId, BlockTimeContext>>,
  initializingContexts: Map<ChainId, Promise<BlockTimeContext>>,
}

export const useBlockTimeStore = defineStore({
  id: "blockTimeStore",
  state: (): IState => {
    return {
      chainBlockTimeContext: {},
      initializingContexts: new Map(),
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
        return this.chainBlockTimeContext[mappedChainId]! as BlockTimeContext;
      }

      if (this.initializingContexts.has(mappedChainId)) {
        return this.initializingContexts.get(mappedChainId)!;
      }

      const initPromise = (async () => {
        const web3Provider = this.web3Store.getWeb3Instance(mappedChainId, convertToL1);
        const currentBlock = await this.web3Store.callWithRetry(
          mappedChainId,
          () => web3Provider.eth.getBlock("latest"),
          0,
          [],
          1000,
        );

        const previousBlock = await this.web3Store.callWithRetry(
          mappedChainId,
          () => web3Provider.eth.getBlock(Number(currentBlock.number) - 1000),
          0,
          [],
          1000,
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
        console.log("blockTime context", context);

        this.chainBlockTimeContext[mappedChainId] = context;
        return context;
      })();

      this.initializingContexts.set(mappedChainId, initPromise);

      try {
        return await initPromise;
      } finally {
        this.initializingContexts.delete(mappedChainId);
      }
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
        const provider = this.web3Store.chainProviders[chainId];

        const latestBlock = Number(
          await this.web3Store.callWithRetry(
            chainId,
            () => provider.eth.getBlockNumber(),
          ),
        );

        const latestBlockData = await this.web3Store.callWithRetry(
          chainId,
          () => provider.eth.getBlock(latestBlock),
        );

        const latestTimestamp = Number(latestBlockData.timestamp);
        const estimatedStartBlock = latestBlock - Math.floor((latestTimestamp - timestamp) / averageBlockTime);

        if (estimatedStartBlock < 0 || estimatedStartBlock > latestBlock) {
          console.error("Invalid estimated start block", estimatedStartBlock, latestBlock);
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
