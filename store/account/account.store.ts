import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import type { LimitFunction } from "p-limit";
import pLimit from "p-limit";
import { defineStore } from "pinia";

import { Web3 } from "web3";
import { useToastStore } from "../toasts/toast.store";

import { useWeb3Store } from "~/store/web3/web3.store";
import { networksMap } from "~/store/web3/networksMap";

interface IState {
  web3Onboard?: any;
  isSwitchingNetworks: boolean;
}

export const useAccountStore = defineStore("accounts", {
  state: (): IState => ({
    web3Onboard: undefined as any | undefined,
    isSwitchingNetworks: false,
  }),
  getters: {
    web3Store() {
      return useWeb3Store();
    },
    toastStore() {
      return useToastStore();
    },
    connectingWallet(): boolean {
      return this.web3Onboard?.connectingWallet ?? false;
    },
    connectedWallet(): WalletState | undefined {
      console.log(
        "accountStore.connectedWallet ",
        this.web3Onboard?.connectedWallet,
      );
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
    activeAccountAddress(): string | undefined {
      return this.activeAccount?.address?.toLowerCase();
    },
    isConnectedWalletUsingLedger(): boolean {
      if (!this.connectedWallet?.label) return false;
      console.log("Connected wallet label:", this.connectedWallet?.label);
      return this.connectedWallet.label === "Ledger";
    },
  },
  actions: {
    async setAlreadyConnectedWallet() {
      console.log("Set already connected Wallet:");
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      await this.setActiveChain(chainId);
    },
    async addNewNetwork(chainId: string) {
      console.log("Add New Network for chain:", chainId);
      const network = networksMap[chainId];
      console.log({
        chainId,
        rpcUrls: toRaw(network.rpcUrls ?? []),
        chainName: toRaw(network.chainNameLong ?? network.chainName),
        nativeCurrency: toRaw(network.nativeCurrency),
        blockExplorerUrls: toRaw(network.blockExplorerUrls),
      });
      return await this.connectedWallet?.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            rpcUrls: toRaw(network.rpcUrls ?? []),
            chainName: toRaw(network.chainNameLong ?? network.chainName),
            nativeCurrency: toRaw(network.nativeCurrency),
            blockExplorerUrls: toRaw(network.blockExplorerUrls),
          },
        ],
      });
    },
    async switchNetwork(chainId: string) {
      this.isSwitchingNetworks = true;
      let errorToThrow;

      try {
        if (this.connectedWallet) {
          // Ask the connected user to switch network.
          await this.setActiveChain(chainId);
        } else {
          // Switch active chain.
          await this.web3Store.init(chainId);
        }

        // Test connection, outer catch block will except exception.
        try {
          await this.web3Store.checkConnection();
        } catch (e: any) {
          this.toastStore.errorToast(
            "Looks like there are RPC connection problems.",
          );
        }
      } catch (error: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (error.code === 4902) {
          try {
            // Add the network if it is not yet added.
            this.toastStore.addToast(
              "Add the selected network to your wallet provider.",
            );
            await this.addNewNetwork(chainId);
            await this.switchNetwork(chainId);
          } catch (addError) {
            console.error("Failed to add the network:", addError);
            this.toastStore.errorToast(
              "Oops, something went wrong while adding a new network.",
            );
            errorToThrow = addError;
          }
        } else {
          this.toastStore.errorToast(
            "Oops, something went wrong while switching networks.",
          );
          errorToThrow = error;
        }
      }
      this.isSwitchingNetworks = false;
      if (errorToThrow) {
        throw errorToThrow;
      }
    },
    async setActiveChain(chainId: string): Promise<void> {
      console.log("setActiveChain", chainId);
      // If the user is currently on a different
      // network, ask him to switch it.
      if (chainId !== this.connectedWalletChainId) {
        await this.connectedWallet?.provider?.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId,
            },
          ],
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
      const { provider, label } = this.web3Onboard?.connectedWallet || {};
      if (provider && label) {
        await this.web3Onboard?.disconnectWallet({ label });
      }

      // Reset to default provider in web3Store.
      await this.web3Store.init();
    },
  },
});
