import type { ChainId } from "~/types/enums/chain_id";
import { useBlockTimeStore } from "~/store/web3/blockTime.store";

// at first, this value could be any string (e.g. "5 business days")
// after that it was the number of days (e.g. 5)
// and now it's a block number (e.g. 31130)
// so we need to consider all these cases and convert them to a human-readable string
export const parsePlannedSettlement = async (chainId: ChainId, plannedSettlementPeriod: string) => {
  const blockTimeStore = useBlockTimeStore();

  // Default to original plannedSettlementPeriod or "N/A" if not available
  let output = plannedSettlementPeriod ?? "N/A";
  if (!chainId) return output;

  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(chainId);

  const blockTime = blockTimeContext?.averageBlockTime || 0;
  const plannedSettlement = Number(plannedSettlementPeriod);

  if (!plannedSettlement || isNaN(plannedSettlement) || plannedSettlement <= 0) {
    return output;
  }

  // Settlement is always quoted as a whole number of units: a depositor cares
  // that their request lands within 3 days, not within 2.7. Hence the rounding
  // here rather than convertBlocksToTime, which other callers use as-is.
  if (plannedSettlement < 100) {
    // If planned settlement is between 1 and 100, display in days
    output = pluralizeWord("day", Math.round(plannedSettlement));
  } else if (blockTime > 0) {
    // Otherwise, convert blocks to time if block time is available
    const { bestValue, bestUnit } = determineTimeValueAndTimeUnit(
      plannedSettlement * blockTime,
    );

    if (bestValue && bestUnit) {
      // Never round down to "0 days" — anything non-zero settles within one unit.
      output = pluralizeWord(bestUnit, Math.max(1, Math.round(bestValue)));
    }
  }

  return output;
};

/**
 * The same planned-settlement field as a duration in seconds. The flows page
 * counts down to the next settlement, which needs the cycle as a number rather
 * than as prose. Returns undefined for the legacy free-text values ("5
 * business days") — those cannot anchor a countdown.
 */
export const parsePlannedSettlementSeconds = async (
  chainId: ChainId,
  plannedSettlementPeriod: string,
): Promise<number | undefined> => {
  const plannedSettlement = Number(plannedSettlementPeriod);
  if (!plannedSettlement || isNaN(plannedSettlement) || plannedSettlement <= 0) {
    return undefined;
  }

  // Same boundary as the prose parser: small values are day counts, larger
  // ones are block counts.
  if (plannedSettlement < 100) {
    return plannedSettlement * 24 * 3600;
  }
  if (!chainId) return undefined;

  const blockTimeStore = useBlockTimeStore();
  const blockTimeContext = await blockTimeStore.initializeBlockTimeContext(chainId);
  const blockTime = blockTimeContext?.averageBlockTime || 0;
  if (blockTime <= 0) return undefined;
  return plannedSettlement * blockTime;
};



