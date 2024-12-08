import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client/core";
import { useSubgraphUrl } from "~/composables/useSubgraphUrl";

export default defineNuxtPlugin(() => {
  const clientCache: Record<string, ApolloClient<any>> = {};

  const getApolloClient = (chainId: string): ApolloClient<any> => {
    if (!clientCache[chainId]) {
      const subgraphUrl = useSubgraphUrl(chainId);
      clientCache[chainId] = new ApolloClient({
        link: new HttpLink({
          uri: subgraphUrl,
        }),
        cache: new InMemoryCache(),
      });
    }

    return clientCache[chainId];
  };

  return {
    provide: {
      getApolloClient,
    },
  };
});
