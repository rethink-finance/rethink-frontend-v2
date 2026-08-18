export const RethinkSubgraphSlugs: Record<string, string> = {
  "0x1": "rethinkfinance-mainnet", // Ethereum Mainnet
  "0xa4b1": "rethinkfinance-arbitrum-one", // Arbitrum One
  "0x89": "rethinkfinance-matic", // Polygon (Matic)
  "0x2105": "rethinkfinance-base", // Base (Coinbase's Layer 2)
};

/**
 * Whether a Rethink subgraph is deployed for a chain at all. HyperEVM has none
 * — The Graph does not index it — so callers must not read a failure there as
 * "the subgraph is down" and stop; there is nothing to be down.
 */
export const hasRethinkSubgraph = (chainId: string): boolean =>
  Boolean(RethinkSubgraphSlugs[chainId]);

/**
 * Chains whose subgraph indexes depositor flows completely enough to stand
 * alone. Ethereum and Base were verified to return exactly the rows the block
 * explorer walk finds; Arbitrum's deployment stopped following the chain and
 * Polygon's indexed nothing, so flows there still need the explorer.
 */
export const SUBGRAPH_FLOW_COVERAGE = new Set<string>(["0x1", "0x2105"]);

export enum SubgraphClientType {
  Rethink = "rethink",
  Zodiac = "zodiac",
}
