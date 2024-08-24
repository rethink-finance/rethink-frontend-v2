import { defineStore } from "pinia";
import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import { Web3 } from "web3";
import ledgerModule from "@web3-onboard/ledger";
import { init } from "@web3-onboard/vue";
import injectedModule from "@web3-onboard/injected-wallets";
import logoSVG from "assets/images/logo_mobile.svg";
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
      console.warn("CONNECTED ", this.web3Onboard?.connectedWallet)
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
      console.log("Connected wallet:", this.connectedWallet);
      console.log("Connected wallet label:", this.connectedWallet.label);
      return this.connectedWallet.label === "Ledger"
    },
  },
  actions: {
    async setActiveChain(chainId: string): Promise<void> {
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
        await this.web3Store.init(chainId, web3Provider);
      }
    },
    async connectWallet() {
      console.warn(" TRY CONNECT")
      const ledger = ledgerModule({
        /**
         * Project ID associated with [WalletConnect account](https://cloud.walletconnect.com)
         */
        walletConnectVersion: 2,
        projectId: "1",
      })
      const injected = injectedModule();

      init({
        wallets: [injected, ledger],
        chains: [
          {
            id: "0x89",
            token: "MATIC",
            label: "Polygon",
            rpcUrl: "https://polygon.drpc.org",
          },
          {
            id: "0x1",
            token: "ETH",
            label: "Ethereum",
            rpcUrl: "https://rpc.ankr.com/eth",
          },
        ],
        theme: "dark",
        appMetadata: {
          name: "Rethink.finance",
          icon: logoSVG,
          logo: logoSVG,
          description: "Powering the transition to decentralised and non-custodial asset management.",
          recommendedInjectedWallets: [
            { name: "MetaMask", url: "https://metamask.io" },
            { name: "WalletConnect", url: "https://cloud.walletconnect.com/sign-in" },
            { name: "Safe", url: "https://app.safe.global/welcome" },
            { name: "Ledger", url: "https://app.safe.global/welcome" },
          ],
        },
      })

      // Connect to the web3-onboard.
      if (!this.web3Onboard) {
        console.error(" NO web 3 onboard")
      }

      try {
        await this.web3Onboard?.connectWallet();
      } catch (error) {
        console.error("Error Luka connecting wallet:", error);
      }
      try {
        await this.setAlreadyConnectedWallet();
      } catch (error) {
        console.error("Error Luka setAlreadyConnectedWallet:", error);
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
    async setAlreadyConnectedWallet() {
      console.log("Set already connected Wallet:", this.web3Onboard);
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      await this.setActiveChain(chainId);
    },
  },
});
