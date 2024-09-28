import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import type { LimitFunction } from "p-limit";
import pLimit from "p-limit";
import { defineStore } from "pinia";
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
      console.log("accountStore.connectedWallet ", this.web3Onboard?.connectedWallet)
      return this.web3Onboard?.connectedWallet || undefined;
    },
    connectedWalletChainId(): string | undefined {
      return this.connectedWallet?.chains[0]?.id;
    },
    isConnected(): boolean {
      return !!this.connectedWallet;
    },
    requestConcurrencyLimit(): LimitFunction {
      // If user is not authenticated, we want to limit concurrent requests to 2.
      // 2 was chosen arbitrary, it needs to be a low number as RPC nodes block requests if too many are made
      // at the same time. If user is authenticated (e.g. through Metamask), they allow more requests at once.
      return this.isConnected ? pLimit(10) : pLimit(2);
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
      console.log("Set already connected Wallet:");
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      await this.setActiveChain(chainId);
    },
    async setActiveChain(chainId: string): Promise<void> {
      console.log("setActiveChain", chainId);
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
      if (this.connectedWallet) {
        web3Provider = new Web3(this.connectedWallet.provider);
      }
      if (web3Provider && web3Provider !== this.web3Store.web3) {
        console.log("web3Provider", web3Provider);
        console.log("web3Store.web3", this.web3Store.web3);
        await this.web3Store.init(chainId, web3Provider);
      }
    },
    async connectWallet() {
      try {
        // when the user connects to the wallet, it will also switch the chain to the last used chainId on the WALLET.
        // but if the last used chainId on the wallet is different from the last used chainId in the local storage,
        // it needs to switch the chain to the last used chainId in the local storage.

        // check the last used chainId in the local storage.
        const lastUsedChainId = localStorage.getItem("lastUsedChainId");
        
        const wallet = await this.web3Onboard?.connectWallet();
        // check the last used chainId on the connected wallet.
        const connectedChainId = wallet?.chains[0]?.id || "";

        // if the last used chainId (from localstorage) is different from the connected wallet chainId,
        // switch the chain to the last used chainId.
        const chainToUse = connectedChainId || lastUsedChainId;
        if (chainToUse !== connectedChainId) {
          await this.setActiveChain(chainToUse);
        }
      } catch (error) {
        console.error("Error connecting wallet:", error);
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
