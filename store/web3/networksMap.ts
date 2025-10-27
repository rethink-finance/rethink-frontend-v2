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
      "https://polygon-rpc.com",
      "https://polygon.drpc.org",
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
      // @dev: this is bad practice, use some proxy for this, here we expose our private RPC (test purposes)
      // "https://eth-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW", // Luka T.
      // "https://eth-mainnet.g.alchemy.com/v2/lXg6ZSnL3CTLUdmws68KNkKm2JnHVxhw", // Rok
      "https://rpc.flashbots.net/fast",
      "https://rpc.flashbots.net",
      "https://ethereum.blockpi.network/v1/rpc/public",
      "https://api.zan.top/node/v1/eth/mainnet/public",
      "https://rpc.ankr.com/eth",
      "https://rpc.lokibuilder.xyz/wallet",
      "https://api.stateless.solutions/ethereum/v1/demo",
      "https://eth.drpc.org",
      "https://endpoints.omniatech.io/v1/eth/mainnet/public",
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
      "https://base.llamarpc.com",
      "https://base-mainnet.public.blastapi.io",
      "https://1rpc.io/base",
      "https://gateway.tenderly.co/public/base",
      "https://mainnet.base.org",
      // "https://base.drpc.org",
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
    icon: getChainIcon("hypeevm"),
    rpcUrls: [
      // @dev: this is bad practice, use some proxy for this, here we expose our private RPC (test purposes)
      // "https://base-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW", Luka T.
      // "https://base-mainnet.g.alchemy.com/v2/lXg6ZSnL3CTLUdmws68KNkKm2JnHVxhw", Rok
      "https://rpc.hyperliquid.xyz/evm",
      // "https://base.drpc.org",
      // "https://base.meowrpc.com",
      // "https://base.rpc.subquery.network/public",
    ],
    blockExplorerUrls: ["https://purrsec.com/"],
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
    name: "token-branded:eth",
    size: "1.5rem",
  },
  DAI: {
    name: "cryptocurrency-color:dai",
    size: "1.5rem",
  },
};
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
    // Verify addresses from official sources
  },
};

/**
 * Get asset icon based on chainId and tokenAddress
 * @param chainId - The chain ID
 * @param tokenAddress - The token address
 * @returns IIcon object with name, size, and optional color properties
 */
export const getAssetIcon = (chainId: string, tokenAddress: string): IIcon => {
  // If we have a tokenAddress and chainId, use TOKEN_ADDRESS_TO_NAME to get the token name
  const tokenAddressLowercase = tokenAddress?.toLowerCase();
  if (tokenAddress && chainId && TOKEN_ADDRESS_TO_NAME[chainId]?.[tokenAddressLowercase]) {
    const tokenName = TOKEN_ADDRESS_TO_NAME[chainId][tokenAddressLowercase];
    return assetIconMap[tokenName] || {
      name: "ph:circle-fill", // default circle fill gray
      size: "1.5rem",
    };
  }

  // When tokenAddress is not provided or not found, return default icon
  return {
    name: "ph:circle-fill", // default circle fill gray
    size: "1.5rem",
  };
};
