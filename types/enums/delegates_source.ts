export enum DelegatesSource {
  /** Served by the backend's on-chain event index — the fast path. */
  Backend = "backend",
  /** Served by the Rethink subgraph. */
  Subgraph = "subgraph",
  /** Rebuilt from the governance token's DelegateChanged logs. */
  OnChain = "onChain",
  /** Neither source could answer; the table is empty because we do not know. */
  Unavailable = "unavailable",
}
