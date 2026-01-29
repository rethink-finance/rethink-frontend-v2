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
 * Get Blockscout URL for a given chain ID and resource (address or tx hash)
 *
 * Examples:
 *  - Address: 0xabc...123 -> https://<chain>.blockscout.com/address/0xabc...123
 *  - Tx hash: 0xdef...456 (66 chars) -> https://<chain>.blockscout.com/tx/0xdef...456
 *
 * @param chainId - The chain ID
 * @param resource - Address (0x + 40 hex) or transaction hash (0x + 64 hex)
 * @returns URL string, or the passed resource if Blockscout is not available for the chain
 */
export const getBlockscoutUrl = (chainId: string, resource: string): string => {
  if (!resource || !chainId) {
    return resource;
  }

  const value = resource.trim();
  if (value === "") {
    return resource;
  }

  const isTxHash = /^0x[0-9a-fA-F]{64}$/.test(value);
  // We still default to address path when not a tx hash
  const path = isTxHash ? "tx" : "address";

  let base = "";
  switch (chainId) {
    case ChainId.ETHEREUM:
      base = "https://eth.blockscout.com";
      break;
    case ChainId.POLYGON:
      base = "https://polygon.blockscout.com";
      break;
    case ChainId.BASE:
      base = "https://base.blockscout.com";
      break;
    case ChainId.ARBITRUM:
      base = "https://arbitrum.blockscout.com";
      break;
    case ChainId.HYPEREVM:
      // No Blockscout URL for HyperEVM
      return resource;
    default:
      return resource;
  }

  return `${base}/${path}/${value}`;
};
