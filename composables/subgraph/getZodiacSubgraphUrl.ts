import { useRuntimeConfig } from "#app";
import { ChainId } from "~/store/web3/networksMap";

const publicVariables = useRuntimeConfig().public;

if (!publicVariables.ZODIAC_GRAPH_BASE_URL) {
  throw new Error("ZODIAC_GRAPH_BASE_URL is not set")
}
if (!publicVariables.ZODIAC_GRAPH_GNOSIS_CHAIN) {
  throw new Error("ZODIAC_GRAPH_GNOSIS_CHAIN is not set")
}
if (!publicVariables.ZODIAC_GRAPH_ETHEREUM) {
  throw new Error("ZODIAC_GRAPH_ETHEREUM is not set")
}
if (!publicVariables.ZODIAC_GRAPH_SEPOLIA) {
  throw new Error("ZODIAC_GRAPH_SEPOLIA is not set")
}
if (!publicVariables.ZODIAC_GRAPH_POLYGON) {
  throw new Error("ZODIAC_GRAPH_POLYGON is not set")
}
if (!publicVariables.ZODIAC_GRAPH_ARBITRUM) {
  throw new Error("ZODIAC_GRAPH_ARBITRUM is not set")
}
if (!publicVariables.ZODIAC_GRAPH_OPTIMISM) {
  throw new Error("ZODIAC_GRAPH_OPTIMISM is not set")
}
if (!publicVariables.ZODIAC_GRAPH_BASE) {
  throw new Error("ZODIAC_GRAPH_BASE is not set")
}

const BASE_GRAPH_URL = publicVariables.ZODIAC_GRAPH_BASE_URL
const GRAPH_GNOSIS_CHAIN = publicVariables.ZODIAC_GRAPH_GNOSIS_CHAIN
const GRAPH_SEPOLIA = publicVariables.ZODIAC_GRAPH_SEPOLIA
const GRAPH_ETHEREUM = publicVariables.ZODIAC_GRAPH_ETHEREUM
const GRAPH_POLYGON = publicVariables.ZODIAC_GRAPH_POLYGON
const GRAPH_ARBITRUM = publicVariables.ZODIAC_GRAPH_ARBITRUM
const GRAPH_OPTIMISM = publicVariables.ZODIAC_GRAPH_OPTIMISM
const GRAPH_BASE = publicVariables.ZODIAC_GRAPH_BASE

export const getZodiacSubgraphUrl = (chainId?: ChainId) => {
  const baseUrl = BASE_GRAPH_URL ||
    "https://airlock.gnosisguild.org/api/v1/subgraph/";

  switch (chainId) {
    case ChainId.ETHEREUM:
      return baseUrl + GRAPH_ETHEREUM
    case ChainId.GNOSIS:
      return baseUrl + GRAPH_GNOSIS_CHAIN
    case ChainId.SEPOLIA:
      return baseUrl + GRAPH_SEPOLIA
    case ChainId.POLYGON:
      return baseUrl + GRAPH_POLYGON
    case ChainId.OPTIMISM:
      return baseUrl + GRAPH_OPTIMISM
    case ChainId.ARBITRUM:
      return baseUrl + GRAPH_ARBITRUM
    case ChainId.BASE:
      return baseUrl + GRAPH_BASE
    default:
      return baseUrl + GRAPH_ETHEREUM
  }
}
