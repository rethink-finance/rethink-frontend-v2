import { defineStore } from "pinia";
import { Web3 } from "web3";
import type INetwork from "~/types/network";

interface IState {
  web3?: Web3;
  chainId: string,
  chainName: string;
  chainIcon: string;
  chainShort: string;
  networksMap: Record<string, INetwork>;
}

export const useWeb3Store = defineStore({
  id: "web3store",
  state: (): IState => ({
    web3: undefined,
    chainId: "",
    chainName: "",
    chainIcon: "",
    chainShort: "",
    networksMap: {
      "0x89": {
        chainId: "0x89",
        chainName: "Polygon",
        chainShort: "matic",
        chainIcon: "cryptocurrency-color:matic",
        rpcUrl: "https://polygon-mainnet.rpcfast.com?api_key=xbhWBI1Wkguk8SNMu1bvvLurPGLXmgwYeC4S6g2H7WdwFigZSmPWVZRxrskEQwIf",
      },
      "0xa4b1": {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        chainShort: "eth",
        chainIcon: "arbitrum1",
        rpcUrl: "https://arbitrum.llamarpc.com/",
      },
    },
  }),
  getters: {
    networks(): INetwork[] {
      return Object.values(this.networksMap);
    },
  },
  actions: {
    init(chainId?: string, web3Provider?: any): void {
      if (!chainId) {
        // Check if there exists last used chainId in the local storage.
        // It also needs to be a valid chainId.
        const lastUsedChainId = localStorage.getItem("lastUsedChainId");
        console.log("LAST USED CHAIN ID: ", chainId);
        if (lastUsedChainId && lastUsedChainId in this.networksMap) {
          chainId = lastUsedChainId;
        } else {
          // Otherwise, return the default chainId.
          chainId = this.networks[0]?.chainId || "";
        }
      }
      console.log("222LAST USED CHAIN ID: ", chainId);

      const network: INetwork = this.networksMap[chainId];
      this.chainName = network.chainName ?? "";
      this.chainShort = network.chainShort ?? "";
      this.chainIcon = network.chainIcon ?? "";

      if (web3Provider) {
        this.web3 = web3Provider;
      } else {
        this.web3 = new Web3(network.rpcUrl);
      }
      // Lastly set chainId, as we sometimes use watcher on chainId to reload other pages.
      this.chainId = chainId;
      localStorage.setItem("lastUsedChainId", chainId.toString());
      console.log(`init web3 chain: ${this.chainId} on ${network.rpcUrl}`);
      console.log("----------------\n")
    },
  },
});
