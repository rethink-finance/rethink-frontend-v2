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
 * Get Blockscout URL for a given chain ID and address
 * @param chainId - The chain ID
 * @param address - The address to link to
 * @returns URL string or the passed address if not available for the chain
 */
export const getBlockscoutUrl = (chainId: string, address: string): string => {
  if (!address || !chainId) {
    return address;
  }

  // Ensure we're working with a valid address
  if (address.trim() === "") {
    return address;
  }

  switch (chainId) {
    case ChainId.ETHEREUM:
      return `https://eth.blockscout.com/address/${address}`;
    case ChainId.POLYGON:
      return `https://polygon.blockscout.com/address/${address}`;
    case ChainId.BASE:
      return `https://base.blockscout.com/address/${address}`;
    case ChainId.ARBITRUM:
      return `https://arbitrum.blockscout.com/address/${address}`;
    case ChainId.HYPEREVM:
      // No Blockscout URL for HyperEVM
      return address;
    default:
      return address;
  }
};
