import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client/core";
import { useSubgraphUrl } from "~/composables/useSubgraphUrl";
import { useWeb3Store } from "~/store/web3/web3.store";

export default defineNuxtPlugin((nuxtApp) => {
  const web3Store = useWeb3Store();
  const clientCache: Record<string, ApolloClient<any>> = {};

  const getApolloClient = (chainId: string): ApolloClient<any> => {
    if (!clientCache[chainId]) {
      const subgraphUrl = useSubgraphUrl(web3Store.chainId);

      clientCache[chainId] = new ApolloClient({
        link: new HttpLink({
          uri: subgraphUrl,
        }),
        cache: new InMemoryCache(),
      });
    }

    return clientCache[chainId];
  };

  const currentClient = computed(() => getApolloClient(web3Store.chainId));

  // Provide the reactive Apollo Client with typing
  nuxtApp.provide("apolloClient", currentClient as Ref<ApolloClient<any>>);
});
