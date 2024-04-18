import { defineStore } from "pinia";
import { Web3 } from "web3";

interface IState {
  web3?: Web3;
  network: string,
  rpcURL: string,
  chainId: string,
}

export const useWeb3Store = defineStore({
  id: "web3store",
  state: (): IState => ({
    web3: undefined,
    network: "polygon-mainnet",
    rpcURL: "https://polygon-rpc.com/",
    chainId: "",
  }),
  actions: {
    async init(): Promise<void> {
      this.web3 = new Web3(this.rpcURL);
      console.log(`init web3 on ${this.rpcURL}`);

      try {
        const chainId = await this.web3.eth.getChainId();
        this.chainId = chainId.toString();
        console.log("Connected to chain ID:", this.chainId);
      } catch (error) {
        console.error("Error getting chain ID:", error);
      }
      console.log("----------------\n")
    },
  },
});
