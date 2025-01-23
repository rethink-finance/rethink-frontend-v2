import { SubgraphClientType } from "~/types/enums/subgraph";
import { getZodiacSubgraphUrl } from "~/composables/subgraph/getZodiacSubgraphUrl";
import { getRethinkSubgraphUrl } from "~/composables/subgraph/getRethinkSubgraphUrl";
import { ChainId } from "~/store/web3/networksMap";

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
