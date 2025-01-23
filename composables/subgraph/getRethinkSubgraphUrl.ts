import { useRuntimeConfig } from "#app";
import { ChainId } from "~/store/web3/networksMap";
import { RethinkSubgraphSlugs } from "~/types/enums/subgraph";

const publicVariables = useRuntimeConfig().public;

if (!publicVariables.GRAPH_BASE_URL) {
  throw new Error("Rethink GRAPH_BASE_URL is not set")
}
if (!publicVariables.GRAPH_USERID) {
  throw new Error("Rethink GRAPH_USERID is not set")
}
if (!publicVariables.GRAPH_VERSION) {
  throw new Error("Rethink GRAPH_VERSION is not set")
}

const BASE_GRAPH_URL = publicVariables.GRAPH_BASE_URL
const GRAPH_USERID = publicVariables.GRAPH_USERID
const GRAPH_VERSION = publicVariables.GRAPH_VERSION


export const getRethinkSubgraphUrl = (
  chainId: ChainId,
): string => {
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
