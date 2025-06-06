import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client/core";
import { useSubgraphUrl } from "~/composables/subgraph/useSubgraphUrl";
import type { ChainId } from "~/types/enums/chain_id";
import { SubgraphClientType } from "~/types/enums/subgraph";



export default defineNuxtPlugin(() => {
  const clientCache: Record<SubgraphClientType, Partial<Record<ChainId, ApolloClient<any>>>> = {
    [SubgraphClientType.Rethink]: {},
    [SubgraphClientType.Zodiac]: {},
  };

  const getApolloClient = (
    chainId: ChainId,
    clientType: SubgraphClientType = SubgraphClientType.Rethink,
  ): ApolloClient<any> => {
    if (!clientCache[clientType][chainId]) {
      const subgraphUrl = useSubgraphUrl(chainId, clientType);
      clientCache[clientType][chainId] = new ApolloClient({
        link: new HttpLink({
          uri: subgraphUrl,
        }),
        cache: new InMemoryCache(),
      });
    }
    return clientCache[clientType][chainId];
  };

  return {
    provide: {
      getApolloClient,
    },
  };
});
