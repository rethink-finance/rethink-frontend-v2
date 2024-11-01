import type Web3 from "web3";
import type BlockTimeContext from "~/types/block_time_context";

export const useBlockTime = () => {
  const blockTimeContext = ref<BlockTimeContext | null>(null);

  const initializeBlockTimeContext = async (
    web3Instance: Web3,
  ): Promise<BlockTimeContext> => {
    const currentBlock = await web3Instance.eth.getBlock("latest");
    const previousBlock = await web3Instance.eth.getBlock(
      Number(currentBlock.number) - 1000,
    );

    const timeDiff =
    Number(currentBlock.timestamp) - Number(previousBlock.timestamp);
    const blockDiff = Number(currentBlock.number) - Number(previousBlock.number);

    const averageBlockTime = (timeDiff) / blockDiff;


    const context: BlockTimeContext = {
      currentBlock: Number(currentBlock.number),
      currentBlockTimestamp: Number(currentBlock.timestamp),
      web3Instance: web3Instance as any,
      averageBlockTime,
    };

    blockTimeContext.value = context;
    return context;
  };

  const getTimestampForBlock = async (
    targetBlock: number,
    context: BlockTimeContext,
  ): Promise<number> => {
    const {
      currentBlock,
      currentBlockTimestamp,
      web3Instance,
      averageBlockTime,
    } = context;

    if (targetBlock <= currentBlock) {
      try {
        const block = await web3Instance.eth.getBlock(targetBlock);
        return Number(block?.timestamp || 0);
      } catch (error) {
        console.error(`Error fetching block ${targetBlock}:`, error);
        return 0;
      }
    }
    const blockDiff = targetBlock - currentBlock;

    const secondsUntilTarget = blockDiff * averageBlockTime;



    return currentBlockTimestamp + secondsUntilTarget;
  };

  return {
    blockTimeContext,
    initializeBlockTimeContext,
    getTimestampForBlock,
  };
};
