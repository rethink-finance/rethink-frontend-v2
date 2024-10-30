// composables/useSubgraphUrl.ts
import { useRuntimeConfig } from "#app";
import { SubgraphSlugs } from "~/types/enums/subgraph_slug";

export function useSubgraphUrl(chainId: string): string {
  const baseUrl =
    useRuntimeConfig().public.GRAPH_BASE_URL ||
    "https://api.studio.thegraph.com/query";
  const userId = useRuntimeConfig().public.GRAPH_USERID || "0";
  const version = useRuntimeConfig().public.GRAPH_VERSION || "version/latest";

  const subgraphSlug = SubgraphSlugs[chainId];
  if (!subgraphSlug) {
    throw new Error(`Subgraph slug not defined for chainId: ${chainId}`);
  }

  return `${baseUrl}${userId}/${subgraphSlug}/${version}`;
}
