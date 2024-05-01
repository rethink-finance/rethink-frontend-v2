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
  },
  actions: {
    async setActiveChain(chainId: string): Promise<void> {
      // If the user is currently on a different
      // network, ask him to switch it.
      console.log("CURRENT NETWORK: ", this.connectedWalletChainId)
      if (chainId !== this.connectedWalletChainId) {
        await this.connectedWallet?.provider?.request({
          method: "wallet_switchEthereumChain",
          params: [{
            chainId,
          }],
        });
      }

      let web3Provider;
      if (this.connectedWallet) {
        web3Provider = new Web3(this.connectedWallet.provider);
      }
      this.web3Store.init(chainId, web3Provider);
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
      this.web3Store.init();
    },
    async setAlreadyConnectedWallet() {
      console.log("Already connected Wallet:", this.web3Onboard);
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      await this.setActiveChain(chainId);
    },
  },
});
