export const RethinkSubgraphSlugs: Record<string, string> = {
  "0x1": "rethinkfinance-mainnet", // Ethereum Mainnet
  "0xa4b1": "rethinkfinance-arbitrum-one", // Arbitrum One
  "0x89": "rethinkfinance-matic", // Polygon (Matic)
  "0x2105": "rethinkfinance-base", // Base (Coinbase's Layer 2)
};

export enum SubgraphClientType {
  Rethink = "rethink",
  Zodiac = "zodiac",
}
