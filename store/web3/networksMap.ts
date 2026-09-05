import { ChainId } from "~/types/enums/chain_id";
import type INetwork from "~/types/network";
import type { IIcon } from "~/types/network";

// Create base networks without the local node
type BaseChainId = Exclude<ChainId, ChainId.LOCAL_NODE>;

export const baseNetworksMap: Record<BaseChainId, INetwork> = {
  [ChainId.POLYGON]: {
    chainId: ChainId.POLYGON,
    chainName: "Polygon",
    chainNameLong: "Polygon Mainnet",
    chainShort: "matic",
    nativeCurrency: {
      name: "POL",
      symbol: "POL",
      decimals: 18,
    },
    icon: getChainIcon("matic"),
    rpcUrls: [
      // @dev: this is bad practice, use some proxy for this, here we expose our private RPC (test purposes)
      // "https://polygon-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW", Luka T.
      // "https://polygon-mainnet.g.alchemy.com/v2/lXg6ZSnL3CTLUdmws68KNkKm2JnHVxhw", Rok
      // Serves UNBOUNDED eth_getLogs ranges (verified 2026-08-10) — the only
      // configured Polygon RPC that does, so the on-chain delegates fallback
      // (services/onchain/delegates.ts) picks this one. Everything below caps.
      "https://polygon.gateway.tenderly.co",
      "https://polygon-rpc.com", // Dead: "API key disabled, tenant disabled" (2026-08-10)
      "https://polygon.drpc.org", // Max 10k blocks on the free plan
      "https://polygon-pokt.nodies.app",
      "https://polygon.rpc.blxrbdn.com",
    ],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  [ChainId.ARBITRUM]: {
    chainId: ChainId.ARBITRUM,
    chainName: "Arbitrum One",
    chainShort: "arb1",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    icon: getChainIcon("arb1"),
    rpcUrls: [
      // @dev: this is bad practice, use some proxy for this, here we expose our private RPC (test purposes)
      // "https://arb-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW", // Luka T.
      // "https://arb-mainnet.g.alchemy.com/v2/lXg6ZSnL3CTLUdmws68KNkKm2JnHVxhw", // Rok
      // "https://arbitrum-mainnet.infura.io/v3/be388d08c0334adbbabb9cd6555165d1", // Luka V. Infura Arbitrum
      "https://arb1.arbitrum.io/rpc", // Max 10k blocks, if auth: more than 1M
      "https://arbitrum.drpc.org", // Max 10k blocks, if auth: more than 1M
      "https://arbitrum.llamarpc.com", // Max 10k blocks
      "https://1rpc.io/arb", // Max 1k blocks
      "https://arb-pokt.nodies.app", // Pruned Node / Light node, no logs...
    ],
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  // [ChainId.FRAXTAL]: {
  //   chainId: ChainId.FRAXTAL,
  //   chainName: "Fraxtal",
  //   chainShort: "frax",
  //   nativeCurrency: {
  //     name: "Frax",
  //     symbol: "frxETH",
  //     decimals: 18,
  //   },
  //   icon: getChainIcon("frax"),
  //   rpcUrls: [
  //     "https://rpc.frax.com",
  //   ],
  //   blockExplorerUrls: ["https://fraxscan.com"],
  // },
  [ChainId.ETHEREUM]: {
    chainId: ChainId.ETHEREUM,
    chainName: "Ethereum",
    chainShort: "eth",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    icon: getChainIcon("eth"),
    rpcUrls: [
      // Probed 2026-09-05 (same pass as the backend list): each of these
      // answers eth_chainId with a CORS allow-origin for app.rethink.finance.
      "https://eth.drpc.org", // Max 10k-block eth_getLogs on the free plan
      // The only one that serves UNBOUNDED eth_getLogs — what the on-chain
      // delegates fallback and the explorer-log reads need.
      "https://mainnet.gateway.tenderly.co",
      "https://rpc.mevblocker.io", // Max 10k-block eth_getLogs
      // Plain calls only: eth_getLogs 504s.
      "https://rpc.flashbots.net/fast",
      "https://rpc.flashbots.net",
      // Dead on 2026-09-05, dropped rather than rotated onto: publicnode
      // (historical reads need a token), cloudflare-eth ("cannot fulfill"),
      // ankr (needs an API key), llamarpc (HTTP 521), 1rpc (discontinued).
      // CORS-blocked: omniatech, zan, lokibuilder, stateless.
      // "https://eth-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW", // Luka T. — FREE TIER
      // "https://eth-mainnet.g.alchemy.com/v2/lXg6ZSnL3CTLUdmws68KNkKm2JnHVxhw", // Rok
    ],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  [ChainId.BASE]: {
    chainId: ChainId.BASE,
    chainName: "Base",
    chainShort: "base",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    icon: getChainIcon("base"),
    rpcUrls: [
      // @dev: this is bad practice, use some proxy for this, here we expose our private RPC (test purposes)
      // "https://base-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW", Luka T.
      // "https://base-mainnet.g.alchemy.com/v2/lXg6ZSnL3CTLUdmws68KNkKm2JnHVxhw", Rok
      // "https://base.llamarpc.com", // TODO don't use llama, it returns latest block 5 days in the past
      "https://base-mainnet.public.blastapi.io",
      "https://1rpc.io/base",
      "https://gateway.tenderly.co/public/base",
      "https://mainnet.base.org",
      "https://base.drpc.org",
      // "https://base.meowrpc.com",
      // "https://base.rpc.subquery.network/public",
    ],
    blockExplorerUrls: ["https://basescan.org"],
  },
  [ChainId.HYPEREVM]: {
    chainId: ChainId.HYPEREVM,
    chainName: "HyperEVM",
    chainShort: "HyperEVM",
    nativeCurrency: {
      name: "Hype",
      symbol: "HYPE",
      decimals: 18,
    },
    icon: getChainIcon("HyperEVM"),
    // Hyperliquid's own RPC refuses eth_getBlockByNumber outright — every call,
    // "latest" included, returns -32005 "More than 3000 archived blocks queried
    // in one day" (verified 2026-08-11). eth_call still works, so vault reads
    // succeed and only block lookups fail, which reads like an indexer problem.
    // It was the sole entry here, leaving switchRpcUrl nowhere to go, so every
    // vault page on this chain died in initializeBlockTimeContext.
    //
    // callWithRetry swaps the provider for every call on the chain, so vet any
    // addition on BOTH counts — one bad entry breaks whatever lands on it:
    //  1. eth_getBlockByNumber, per above.
    //  2. The HyperCore precompiles (0x...0801 spotBalance, 0x...080F
    //     accountMarginSummary) that NAV positions are priced from. drpc,
    //     hyperlend and stakely all answer "out of gas: gas exhausted during
    //     precompiled contract execution" and quietly zero those positions.
    // Both endpoints below pass both, full-archive, open CORS. The official one
    // stays last: it serves the precompiles, just not the blocks. eth_getLogs is
    // capped chain-wide (100k blocks on purroofgroup, 1k on the other two).
    rpcUrls: [
      "https://rpc.purroofgroup.com",
      "https://rpc.hypurrscan.io",
      "https://rpc.hyperliquid.xyz/evm",
    ],
    blockExplorerUrls: ["https://hyperevmscan.io"],
  },
};
// Add Hardhat network only in development mode
const localhostNetwork: INetwork = {
  chainId: ChainId.LOCAL_NODE,
  chainName: "Local Node (31337)",
  chainShort: "local",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  icon: getChainIcon("local"),
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

// Conditionally include localhost network based on environment
export const networksMap: Record<string, INetwork> =
  process.env.NODE_ENV === "development"
    ? { ...baseNetworksMap, [ChainId.LOCAL_NODE]: localhostNetwork }
    : baseNetworksMap;


export const chainIds: ChainId[] = Object.keys(networksMap) as ChainId[];
export const networks: INetwork[] = Object.values(networksMap);

export const networkChoices = networks.map(
  (network: INetwork) => ({
    value: network.chainId,
    title: network.chainName,
  }),
);


export const assetIconMap: Record<string, IIcon> = {
  USDC: {
    name: "cryptocurrency-color:usdc",
    size: "1.5rem",
  },
  WETH: {
    name: "custom:weth",
    size: "1.5rem",
  },
  DAI: {
    name: "cryptocurrency-color:dai",
    size: "1.5rem",
  },
  WBTC: {
    name: "cryptocurrency-color:wbtc",
    size: "1.5rem",
  },
};

/**
 * The mark for a token symbol. The map above is keyed by symbol already;
 * getAssetIcon only reaches it by address, which half the callers do not have —
 * a row that knows it is showing DAI and nothing more still has an icon coming.
 */
export const getAssetIconBySymbol = (symbol?: string): IIcon | undefined =>
  symbol ? assetIconMap[symbol.toUpperCase()] : undefined;
const TOKEN_ADDRESS_TO_NAME: any = {
  [ChainId.ETHEREUM]: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  },
  [ChainId.BASE]: {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",
  },
  [ChainId.POLYGON]: {
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WETH",
    "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": "DAI",
  },
  [ChainId.ARBITRUM]: {
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": "DAI",
  },
  [ChainId.HYPEREVM]: {
    "0xb88339cb7199b77e23db6e890353e22632ba630f": "USDC",
    "0x9fdbda0a5e284c32744d2f17ee5c74b284993463": "WBTC",
    "0xbe6727b535545c67d5caa73dea54865b92cf7907": "WETH",
  },
};

/**
 * The symbol a base asset is known by, from its address. Only covers the base
 * assets the app lists, so callers that already hold a symbol should use that.
 */
export const getTokenSymbolByAddress = (
  chainId: string,
  tokenAddress: string,
): string | undefined => {
  if (!chainId || !tokenAddress) return undefined;
  return TOKEN_ADDRESS_TO_NAME[chainId]?.[tokenAddress.toLowerCase()];
};

/**
 * The mark for a token by address, or undefined when there is none.
 *
 * Undefined rather than a grey disc: most of what this is asked about is a
 * vault's own share token, which no icon set will ever carry, and a blank disc
 * beside it says nothing a reader did not already know from the symbol.
 *
 * @param chainId - The chain ID
 * @param tokenAddress - The token address
 */
export const getAssetIcon = (
  chainId: string,
  tokenAddress: string,
): IIcon | undefined => {
  const tokenAddressLowercase = tokenAddress?.toLowerCase();
  if (!tokenAddress || !chainId) return undefined;

  const tokenName = TOKEN_ADDRESS_TO_NAME[chainId]?.[tokenAddressLowercase];
  return tokenName ? assetIconMap[tokenName] : undefined;
};
