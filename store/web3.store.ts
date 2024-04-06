import { defineStore } from "pinia";
import { Web3 } from "web3";

interface IState {
  web3?: Web3;
  network: string,
  chainId: string,
}

export const useWeb3Store = defineStore({
  id: "web3store",
  state: (): IState => ({
    web3: undefined,
    network: "polygon-mainnet",
    chainId: "",
  }),
  actions: {
    async init(): Promise<void> {
      const runtimeConfig = useRuntimeConfig();
      // TODO change to other RPC, not infura
      const projectId = runtimeConfig.public.INFURA_PROJECT_ID || "";
      const rpcURL = `https://${this.network}.infura.io/v3/${projectId}`;
      this.web3 = new Web3(rpcURL);
      console.log(`init web3 on ${rpcURL}`);

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
