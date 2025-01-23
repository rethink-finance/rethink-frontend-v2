import type INetwork from "~/types/network";

export const networksMap: Record<string, INetwork> = {
  "0x89": {
    chainId: "0x89",
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
      // "https://polygon-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW",
      "https://polygon-rpc.com",
      "https://polygon.drpc.org",
      "https://polygon-pokt.nodies.app",
      "https://polygon.rpc.blxrbdn.com",
    ],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  "0xa4b1": {
    chainId: "0xa4b1",
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
      // "https://arb-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW",
      "https://arb1.arbitrum.io/rpc", // Max 10k blocks, if auth: more than 1M
      "https://arbitrum.drpc.org", // Max 10k blocks, if auth: more than 1M
      "https://arbitrum.llamarpc.com", // Max 10k blocks
      "https://1rpc.io/arb", // Max 1k blocks
      "https://arb-pokt.nodies.app", // Pruned Node / Light node, no logs...
    ],
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  // "0xfc": {
  //   chainId: "0xfc",
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
  "0x1": {
    chainId: "0x1",
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
      // "https://eth-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW",
      "https://eth.drpc.org",
      "https://endpoints.omniatech.io/v1/eth/mainnet/public",
      "https://ethereum.blockpi.network/v1/rpc/public",
      "https://api.zan.top/node/v1/eth/mainnet/public",
      "https://rpc.ankr.com/eth",
      "https://rpc.flashbots.net/fast",
      "https://rpc.flashbots.net",
      "https://rpc.lokibuilder.xyz/wallet",
      "https://api.stateless.solutions/ethereum/v1/demo",
    ],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  "0x2105": {
    chainId: "0x2105",
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
      // "https://base-mainnet.g.alchemy.com/v2/aejbVoMPkKiAxRxDfXKwIO2roAoZndIW",
      "https://mainnet.base.org",
      "https://base.llamarpc.com",
      "https://base-mainnet.public.blastapi.io",
      "https://1rpc.io/base",
      "https://gateway.tenderly.co/public/base",
      // "https://base.drpc.org",
      // "https://base.meowrpc.com",
      // "https://base.rpc.subquery.network/public",
    ],
    blockExplorerUrls: ["https://basescan.org"],
  },
};

export const chainIds: string[] = Object.keys(networksMap);
export const networks: INetwork[] = Object.values(networksMap);

export const networkChoices = networks.map(
  (network: INetwork) => (
    {
      value: network.chainId,
      title: network.chainName,
    }
  ),
);
