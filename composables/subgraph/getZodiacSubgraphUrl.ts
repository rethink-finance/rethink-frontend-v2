import { useRuntimeConfig } from "#app";
import { ChainId } from "~/store/web3/networksMap";


export const getZodiacSubgraphUrl = (chainId?: ChainId) => {
  const publicVariables = useRuntimeConfig().public;
  const BASE_GRAPH_URL = publicVariables.ZODIAC_GRAPH_BASE_URL
  const baseUrl = BASE_GRAPH_URL ||
    "https://airlock.gnosisguild.org/api/v1/subgraph/";

  switch (chainId) {
    case ChainId.ETHEREUM:
      return baseUrl + publicVariables.ZODIAC_GRAPH_ETHEREUM
    // case ChainId.GNOSIS:
    //   return baseUrl + publicVariables.ZODIAC_GRAPH_GNOSIS_CHAIN
    // case ChainId.SEPOLIA:
    //   return baseUrl + publicVariables.ZODIAC_GRAPH_SEPOLIA
    case ChainId.POLYGON:
      return baseUrl + publicVariables.ZODIAC_GRAPH_POLYGON
    // case ChainId.OPTIMISM:
    //   return baseUrl + publicVariables.ZODIAC_GRAPH_OPTIMISM
    case ChainId.ARBITRUM:
      return baseUrl + publicVariables.ZODIAC_GRAPH_ARBITRUM
    case ChainId.BASE:
      return baseUrl + publicVariables.ZODIAC_GRAPH_BASE
    default:
      return baseUrl + publicVariables.ZODIAC_GRAPH_ETHEREUM
  }
}
