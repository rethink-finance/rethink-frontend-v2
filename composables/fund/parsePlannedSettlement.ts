
import type { ChainId } from "~/store/web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";

// at first, this value could be any string (e.g. "5 business days")
// after that it was the number of days (e.g. 5)
// and now it's a block number (e.g. 31130)
// so we need to consider all these cases and convert them to a human readable string
export const parsePlannedSettlement = async (chainId: ChainId, plannedSettlementPeriod: string) => {
  const web3Store = useWeb3Store();
  const { initializeBlockTimeContext } = useBlockTime();

  // Default to original plannedSettlementPeriod or "N/A" if not available
  let output = plannedSettlementPeriod ?? "N/A";

  const web3Instance = web3Store.getWeb3Instance(chainId);
  if (!web3Instance) return output;

  const context = await initializeBlockTimeContext(web3Instance);
  const blockTime = context?.averageBlockTime || 0;
  const plannedSettlement = Number(plannedSettlementPeriod);

  if (!plannedSettlement || isNaN(plannedSettlement) || plannedSettlement <= 0) {
    return output;
  }

  // If planned settlement is between 1 and 100, display in days
  if (plannedSettlement < 100) {
    output = pluralizeWord("day", plannedSettlement)
  }
  // Otherwise, convert blocks to time if block time is available
  else if (blockTime > 0) {
    output = convertBlocksToTime(plannedSettlement, blockTime) || output;

    // // always show in days
    // const days = Math.round(plannedSettlement * blockTime / 86400);
    // output = pluralizeWord("day", days);
  }

  return output;
};



