import { useRuntimeConfig } from "#app";
import { ChainId } from "~/types/enums/chain_id";
import { RethinkSubgraphSlugs } from "~/types/enums/subgraph";




export const getRethinkSubgraphUrl = (
  chainId: ChainId,
): string => {
  const publicVariables = useRuntimeConfig().public;
  const BASE_GRAPH_URL = publicVariables.GRAPH_BASE_URL
  const GRAPH_USERID = publicVariables.GRAPH_USERID
  const GRAPH_VERSION = publicVariables.GRAPH_VERSION

  const baseUrl = BASE_GRAPH_URL ||
    "https://api.studio.thegraph.com/query";

  const userId = GRAPH_USERID || "0";
  const version = GRAPH_VERSION || "version/latest";

  const subgraphSlug = RethinkSubgraphSlugs[chainId];
  if (!subgraphSlug) {
    throw new Error(`Rethink Subgraph slug not defined for chainId: ${chainId}`);
  }

  return `${baseUrl}${userId}/${subgraphSlug}/${version}`;
}
