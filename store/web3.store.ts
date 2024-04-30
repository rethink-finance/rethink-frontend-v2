import { defineStore } from "pinia";
import { Web3 } from "web3";
import type INetwork from "~/types/network";

interface IState {
  web3?: Web3;
  chainId: string,
  networksMap: Record<string, INetwork>;
}

export const useWeb3Store = defineStore({
  id: "web3store",
  state: (): IState => ({
    web3: undefined,
    chainId: "0x89",
    networksMap: {
      "0x89": {
        chainId: "0x89",
        chainName: "Polygon",
        chainNativeToken: "matic",
        chainIcon: "cryptocurrency-color:matic",
        rpcURL: "https://polygon-rpc.com/",
      },
      "0xa4b1": {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        chainNativeToken: "eth",
        chainIcon: "arbitrum1",
        rpcURL: "https://arbitrum.llamarpc.com/",
      },
    },
  }),
  getters: {
    networks(): INetwork[] {
      return Object.values(this.networksMap);
    },
  },
  actions: {
    init(chainId?: string): void {
      if (!chainId) chainId = this.networks[0].chainId;
      this.chainId = chainId;

      const network: INetwork = this.networksMap[this.chainId];

      this.web3 = new Web3(network.rpcURL);
      console.log(`init web3 chain: ${this.chainId} on ${network.rpcURL}`);
      console.log("----------------\n")
    },
  },
});
