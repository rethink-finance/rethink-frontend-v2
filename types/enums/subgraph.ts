export const RethinkSubgraphSlugs: Record<string, string> = {
  "0x1": "rethinkfinance-mainnet", // Ethereum Mainnet
  "0xa4b1": "rethinkfinance-arbitrum-one", // Arbitrum One
  "0x89": "rethinkfinance-matic", // Polygon (Matic)
  "0x2105": "rethinkfinance-base", // Base (Coinbase's Layer 2)
};

/**
 * Rethink subgraphs hosted somewhere other than The Graph Studio, by full query
 * URL. The Graph does not index HyperEVM, so its subgraph runs on Goldsky;
 * `prod` is the tag the current version is published under, so a redeploy
 * moves the tag and this URL keeps working.
 */
export const RethinkSubgraphEndpoints: Record<string, string> = {
  "0x3e7":
    "https://api.goldsky.com/api/public/project_cms964k1qnkxv01ry6mwmafmm/subgraphs/rethinkfinance-hyperevm/prod/gn",
};

/**
 * Whether a Rethink subgraph is deployed for a chain at all, so callers can
 * skip the tier instead of reading a missing deployment as one that is down.
 */
export const hasRethinkSubgraph = (chainId: string): boolean =>
  Boolean(RethinkSubgraphSlugs[chainId] || RethinkSubgraphEndpoints[chainId]);

/**
 * Chains whose subgraph indexes depositor flows completely enough to stand
 * alone. Ethereum and Base were verified to return exactly the rows the block
 * explorer walk finds. Arbitrum, Polygon and HyperEVM have no trace_filter, so
 * their subgraphs follow token Transfers instead of fundFlowsCall and cannot
 * see the requests that move no tokens (requestDeposit, requestWithdraw,
 * revokeDepositWithrawal); flows there still need the explorer.
 */
export const SUBGRAPH_FLOW_COVERAGE = new Set<string>(["0x1", "0x2105"]);

export enum SubgraphClientType {
  Rethink = "rethink",
  Zodiac = "zodiac",
}
