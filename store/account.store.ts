import { defineStore } from "pinia";
import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import { Web3 } from "web3";
import { useWeb3Store } from "~/store/web3.store";

interface IState {
  web3Onboard?: any;
}


export const useAccountStore = defineStore("accounts", {
  state: (): IState => ({
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
      console.warn("accountStore,connectedWallet ", this.web3Onboard?.connectedWallet)
      return this.web3Onboard?.connectedWallet || undefined;
    },
    connectedWalletChainId(): string | undefined {
      return this.connectedWallet?.chains[0]?.id;
    },
    isConnected(): boolean {
      return !!this.connectedWallet;
    },
    activeAccount(): Account | undefined {
      return this.web3Onboard?.connectedWallet?.accounts[0];
    },
    isConnectedWalletUsingLedger(): boolean {
      if (!this.connectedWallet?.label) return false;
      console.log("Connected wallet label:", this.connectedWallet?.label);
      return this.connectedWallet.label === "Ledger"
    },
  },
  actions: {
    async setAlreadyConnectedWallet() {
      console.warn("Set already connected Wallet:", this.web3Onboard);
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      await this.setActiveChain(chainId);
    },
    async setActiveChain(chainId: string): Promise<void> {
      console.warn("setActiveChain", chainId);
      // If the user is currently on a different
      // network, ask him to switch it.
      if (chainId !== this.connectedWalletChainId) {
        await this.connectedWallet?.provider?.request({
          method: "wallet_switchEthereumChain",
          params: [{
            chainId,
          }],
        });
      }

      let web3Provider;
      console.warn("setActiveChain connectedWallet.provider", toRaw(this.connectedWallet?.provider));
      if (this.connectedWallet) {
        web3Provider = new Web3(this.connectedWallet.provider);
      }
      console.warn("setActiveChain web3Provider", web3Provider, this.web3Store.web3, web3Provider === this.web3Store.web3);
      if (web3Provider && web3Provider !== this.web3Store.web3) {
        console.warn("setActiveChain is different web3Provider")
        await this.web3Store.init(chainId, web3Provider);
      }
    },
    async connectWallet() {
      console.warn(" TRY CONNECT")
      try {
        await this.web3Onboard?.connectWallet();
      } catch (error) {
        console.error("Error Luka connecting wallet:", error);
      }
    },
    async disconnectWallet() {
      const { provider, label } = this.web3Onboard?.connectedWallet || {}
      if (provider && label) {
        await this.web3Onboard?.disconnectWallet({ label })
      }

      // Reset to default provider in web3Store.
      await this.web3Store.init();
    },
  },
});
