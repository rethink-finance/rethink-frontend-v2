import { getRethinkSubgraphUrl } from "~/composables/subgraph/getRethinkSubgraphUrl";
import { getZodiacSubgraphUrl } from "~/composables/subgraph/getZodiacSubgraphUrl";
import { ChainId } from "~/types/enums/chain_id";
import { SubgraphClientType } from "~/types/enums/subgraph";

export function useSubgraphUrl(
  chainId: ChainId,
  clientType: SubgraphClientType,
): string {

  switch (clientType) {
    case SubgraphClientType.Rethink:
      return getRethinkSubgraphUrl(chainId);
    case SubgraphClientType.Zodiac:
      return getZodiacSubgraphUrl(chainId);
    default:
      throw new Error(`Unknown client type: ${clientType}`);
  }
}
