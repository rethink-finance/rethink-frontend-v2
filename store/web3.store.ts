import { defineStore } from "pinia";
import { Web3 } from "web3";
import type INetwork from "~/types/network";

interface IState {
  web3?: Web3;
  chainId: string,
  chainName: string;
  chainShort: string;
  networksMap: Record<string, INetwork>;
  cachedTokens: Record<string, any>;
}

export const useWeb3Store = defineStore({
  id: "web3store",
  state: (): IState => ({
    web3: undefined,
    chainId: "",
    chainName: "",
    chainShort: "",
    networksMap: {
      "0x89": {
        chainId: "0x89",
        chainName: "Polygon",
        chainShort: "matic",
        rpcUrl: "https://polygon.llamarpc.com",
        rpcUrls: [
          "https://polygon.llamarpc.com",
          "https://polygon.drpc.org",
          "https://polygon-pokt.nodies.app",
          "https://polygon.rpc.blxrbdn.com",
        ],
      },
      "0xa4b1": {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        chainShort: "arb1",
        rpcUrl: "https://arbitrum.drpc.org",
        rpcUrls: [
          "https://arbitrum.llamarpc.com",
          "https://1rpc.io/arb",
          "https://arb-pokt.nodies.app",
          "https://arbitrum.drpc.org",
        ],
      },
      "0xfc": {
        chainId: "0xfc",
        chainName: "Fraxtal",
        chainShort: "frax",
        rpcUrl: "https://rpc.frax.com",
      },
    },
    cachedTokens: {
      "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063": {
        symbol: "DAI",
        decimals: 18,
      },
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": {
        symbol: "USDC",
        decimals: 6,
      },
    },
  }),
  getters: {
    networks(): INetwork[] {
      return Object.values(this.networksMap);
    },
    currentRPC(): string {
      const currentProvider: any = this.web3?.provider;
      console.log("provider: ", currentProvider);

      // Check if the provider has a 'host' attribute (HTTP Provider)
      if (currentProvider?.clientUrl) {
        return currentProvider.clientUrl;
      }
      return "";
    },
  },
  actions: {
    /**
     * Fetches specified information (e.g., 'symbol', 'decimals') about a token from a smart contract.
     * If the information is cached, it returns the cached value to avoid unnecessary blockchain calls.
     * Otherwise, it fetches the information using the specified contract method, caches it, and returns it.
     *
     * @param {Object} tokenContract - The web3 contract instance of the token.
     * @param {string} tokenAddress - The address of the token contract.
     * @param {string} infoType - The type of information to fetch from the token contract ('symbol' or 'decimals').
     * @returns {Promise<string|number>} - A promise that resolves with the token information (either a string for the symbol or a number for the decimals).
     */
    async getTokenInfo<T>(tokenContract: any, infoType: string, tokenAddress?: string): Promise<T | undefined> {
      if (!tokenAddress) return undefined;

      // Check if the cached value already exists.
      if (this.cachedTokens[tokenAddress] && this.cachedTokens[tokenAddress][infoType]) {
        return this.cachedTokens[tokenAddress][infoType];
      }

      // It does not exist, fetch it from the contract method.
      const value = await tokenContract.methods[infoType]().call();
      this.cachedTokens[tokenAddress] = this.cachedTokens[tokenAddress] || {};
      this.cachedTokens[tokenAddress][infoType] = value;
      return value;
    },
    async init(chainId?: string, web3Provider?: any): Promise<void> {
      if (!chainId) {
        // Check if there exists last used chainId in the local storage.
        // It also needs to be a valid chainId.
        const lastUsedChainId = localStorage.getItem("lastUsedChainId");
        if (lastUsedChainId && lastUsedChainId in this.networksMap) {
          chainId = lastUsedChainId;
        } else {
          // Otherwise, return the default chainId.
          chainId = this.networks[0]?.chainId || "";
        }
      }

      const network: INetwork = this.networksMap[chainId];
      this.chainName = network.chainName ?? "";
      this.chainShort = network.chainShort ?? "";

      if (web3Provider) {
        this.web3 = web3Provider;
      } else {
        const rpcUrls = network.rpcUrls || [network.rpcUrl];
        for (const rpcUrl of rpcUrls) {
          this.web3 = new Web3(rpcUrl);

          try {
            console.log("Check connection for RPC url", rpcUrl);
            const lastBlock = await this.checkConnection();
            if (!lastBlock || lastBlock <= 0n) {
              continue;
            }
            console.log("lastBlock: ", lastBlock);
            break;
          } catch (e: any) {
            console.log("Connection failed for RPC url", rpcUrl, e);
          }
        }
      }


      // Lastly set chainId, as we sometimes use watcher on chainId to reload other pages.
      this.chainId = chainId;
      localStorage.setItem("lastUsedChainId", chainId.toString());
      console.log(`init web3 chain: ${this.chainId} on ${this.currentRPC}`);
      console.log("----------------\n")
    },
    async checkConnection() {
      return await this.web3?.eth.getBlockNumber();
    },
  },
});
