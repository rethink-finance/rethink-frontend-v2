export interface ExplorerConfig {
  apiUrl: string
  apiKey?: string
  /**
   * Decimal chain id, sent as `chainid` on every request. Set for the
   * unified Etherscan v2 API, which serves every chain from one host; the
   * per-chain v1 hosts (and purrsec / ethernal) take no such parameter.
   */
  chainId?: number
}
