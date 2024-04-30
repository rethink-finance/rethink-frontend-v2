import { defineStore } from "pinia";
import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import { Web3 } from "web3";
import { useWeb3Store } from "~/store/web3.store";

interface IState {
  chainId?: string;
  chainName: string;
  chainIcon: string;
  chainShort: string;
  web3Onboard?: any;
}


export const useAccountsStore = defineStore("accounts", {
  state: (): IState => ({
    chainId: undefined,
    chainName: "",
    chainIcon: "",
    chainShort: "",
    web3Onboard: undefined as any | undefined,
  }),
  getters: {
    web3Store() {
      return useWeb3Store();
    },
    connectingWallet(): boolean {
      return this.web3Onboard?.connectingWallet ?? false;
    },
    connectedWallet(): WalletState | undefined {
      return this.web3Onboard?.connectedWallet || undefined;
    },
    isConnected(): boolean {
      return !!this.connectedWallet;
    },
    activeAccount(): Account | undefined {
      return this.web3Onboard?.connectedWallet?.accounts[0];
    },
    getChainId(state): string {
      return state.chainId ?? "";
    },
  },
  actions: {
    resetState() {
      this.chainId = undefined;
      this.chainName = "";
      this.chainIcon = "";
      this.chainShort = "";
      this.web3Store.init();
    },
    setActiveChain(chainId: string): void {
      console.log("setActiveChainId: ", chainId);
      this.chainId = chainId;
      const chain: any = this.web3Store.networksMap[chainId];
      this.chainName = chain?.chainName ?? "";
      this.chainShort = chain?.chainShort ?? "";
      this.chainIcon = chain?.chainIcon ?? "";

      if (this.connectedWallet) {
        this.web3Store.web3 = new Web3(this.connectedWallet.provider);
        this.web3Store.chainId = chainId;
      } else {
        this.web3Store.init(chainId);
      }

      console.log("setActiveChain id: ", this.chainId, " name: ", this.chainName);
    },
    async connectWallet() {
      // Connect to the web3-onboard.
      await this.web3Onboard?.connectWallet();
      this.setAlreadyConnectedWallet();
    },
    async disconnectWallet() {
      const { provider, label } = this.web3Onboard?.connectedWallet || {}
      if (provider && label) {
        await this.web3Onboard?.disconnectWallet({ label })
      }

      // Reset to default provider in web3Store.
      this.resetState();
    },
    setAlreadyConnectedWallet() {
      console.log("Already connected Wallet:", this.web3Onboard);
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      this.setActiveChain(chainId);
    },
  },
});
