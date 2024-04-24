const chainToIconMap: Record<string, string> = {
  ethereum: "eth",
  polygon: "matic",
  arbitrum1: "arb1",
  bitcoin: "btc",
  binance: "bnb",
  cardano: "ada",
  solana: "sol",
  ripple: "xrp",
  polkadot: "dot",
  avalanche: "avax",
  dogecoin: "doge",
  litecoin: "ltc",
  // Add more if needed.
};

export const chainIconName = (chain?: string): string => {
  /**
   * Icons are available here:
   * https://icones.js.org/collection/cryptocurrency-color
   **/
  if (!chain) return "";
  const iconName = chainToIconMap[chain];
  return iconName ? `cryptocurrency-color:${iconName}` : "";
}
