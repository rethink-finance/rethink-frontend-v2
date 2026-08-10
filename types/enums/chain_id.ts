export enum ChainId {
  ETHEREUM = "0x1",
  BASE = "0x2105",
  POLYGON = "0x89",
  ARBITRUM = "0xa4b1",
  HYPEREVM = "0x3e7",
  LOCAL_NODE = "0x7A69", // 31337
  // GOERLI = "0x5",
  // SEPOLIA = "0x6a9",
  // OPTIMISM = "0xa",
  // OPTIMISM_ON_GNOSIS = "0x12c",
  // BINANCE = "0x38",
  // GNOSIS = "0x64",
  // EWT = "0xf6",
  // AVALANCHE = "0xa86a",
  // VOLTA = "0x12077",
  // AURORA = "0x4e454152",
  // FRAXTAL = "0xfc"
}

/**
 * Blockscout instances, read from only — this is the JSON API the app pulls
 * transaction lists out of. Nothing user-facing points here; links go to
 * EXPLORER_BASE_URLS, which is a different set of hosts entirely.
 */
export const BLOCKSCOUT_BASE_URLS: Partial<Record<ChainId, string>> = {
  [ChainId.ETHEREUM]: "https://eth.blockscout.com",
  [ChainId.POLYGON]: "https://polygon.blockscout.com",
  [ChainId.BASE]: "https://base.blockscout.com",
  [ChainId.ARBITRUM]: "https://arbitrum.blockscout.com",
};

/**
 * Where a link sends someone, for every chain the app supports. These are the
 * explorers the project points at, and the only ones — anything else, however
 * good, is not what a depositor is expecting to land on. All five serve
 * /address/, /tx/ and /block/ at the same paths.
 */
const EXPLORER_BASE_URLS: Partial<Record<ChainId, string>> = {
  [ChainId.ETHEREUM]: "https://etherscan.io",
  [ChainId.POLYGON]: "https://polygonscan.com",
  [ChainId.BASE]: "https://basescan.org",
  [ChainId.ARBITRUM]: "https://arbiscan.io",
  [ChainId.HYPEREVM]: "https://hyperevmscan.io",
};

/** Blockscout API root for a chain, or undefined when there is no instance. */
export const getBlockscoutApiUrl = (chainId: string): string | undefined =>
  BLOCKSCOUT_BASE_URLS[chainId as ChainId];

/**
 * Get the block explorer URL for a given chain ID and resource (address or tx hash)
 *
 * Examples:
 *  - Address: 0xabc...123 -> https://etherscan.io/address/0xabc...123
 *  - Tx hash: 0xdef...456 (66 chars) -> https://etherscan.io/tx/0xdef...456
 *
 * @param chainId - The chain ID
 * @param resource - Address (0x + 40 hex) or transaction hash (0x + 64 hex)
 * @returns URL string, or the passed resource if no explorer is known for the chain
 */
export const getExplorerUrl = (chainId: string, resource: string): string => {
  if (!resource || !chainId) {
    return resource;
  }

  const value = resource.trim();
  if (value === "") {
    return resource;
  }

  const base = EXPLORER_BASE_URLS[chainId as ChainId];
  if (!base) {
    return resource;
  }

  const isTxHash = /^0x[0-9a-fA-F]{64}$/.test(value);
  // We still default to address path when not a tx hash
  const path = isTxHash ? "tx" : "address";

  return `${base}/${path}/${value}`;
};

/**
 * The explorer page for a block. Every explorer we link to serves it at
 * /block/<number>, the same way they all serve /address/ and /tx/.
 *
 * @returns URL string, or undefined when the chain has no explorer we know of
 */
export const getExplorerBlockUrl = (
  chainId: string,
  blockNumber?: bigint | number | string,
): string | undefined => {
  const base = EXPLORER_BASE_URLS[chainId as ChainId];
  if (!base || blockNumber === undefined || blockNumber === null) {
    return undefined;
  }

  const value = String(blockNumber).trim();
  return value === "" || value === "0" ? undefined : `${base}/block/${value}`;
};
