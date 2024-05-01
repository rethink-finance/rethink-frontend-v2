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
    chainId: "0x89",
    chainName: "",
    chainIcon: "",
    chainShort: "",
    networksMap: {
      "0x89": {
        chainId: "0x89",
        chainName: "Polygon",
        chainShort: "matic",
        chainIcon: "cryptocurrency-color:matic",
        rpcUrl: "wss://polygon-bor-rpc.publicnode.com",
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
    init(chainId?: string): void {
      if (!chainId) chainId = this.networks[0].chainId;
      this.chainId = chainId;

      const network: INetwork = this.networksMap[this.chainId];

      this.web3 = new Web3(network.rpcUrl);
      console.log(`init web3 chain: ${this.chainId} on ${network.rpcUrl}`);
      console.log("----------------\n")
    },
    resetState() {
      this.chainId = "";
      this.chainName = "";
      this.chainIcon = "";
      this.chainShort = "";
      this.init();
    },
    setActiveChain(chainId: string, web3Provider?: any): void {
      console.log("setActiveChainId: ", chainId);
      this.chainId = chainId;
      const chain: any = this.networksMap[chainId];
      this.chainName = chain?.chainName ?? "";
      this.chainShort = chain?.chainShort ?? "";
      this.chainIcon = chain?.chainIcon ?? "";

      if (web3Provider) {
        this.web3 = web3Provider;
      } else {
        this.init(chainId);
      }

      console.log("setActiveChain id: ", this.chainId, " name: ", this.chainName);
    },
  },
});
