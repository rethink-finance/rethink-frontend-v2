import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import type { LimitFunction } from "p-limit";
import pLimit from "p-limit";
import { defineStore } from "pinia";

import { Web3 } from "web3";
import { useToastStore } from "../toasts/toast.store";

import { networksMap } from "../web3/networksMap";
import { useWeb3Store } from "~/store/web3/web3.store";
import { type ChainId } from "~/types/enums/chain_id";

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
      return this.web3Onboard?.connectedWallet || undefined;
    },
    connectedWalletChainId(): ChainId | undefined {
      return this.connectedWallet?.chains[0]?.id as ChainId;
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
      return this.activeAccount?.address;
    },
    isConnectedWalletUsingLedger(): boolean {
      if (!this.connectedWallet?.label) return false;
      console.log("Connected wallet label:", this.connectedWallet?.label);
      return this.connectedWallet.label === "Ledger";
    },
    connectedWalletWeb3(): Web3 | undefined {
      let web3Provider;
      if (this.connectedWallet) {
        web3Provider = new Web3(this.connectedWallet.provider);
      }
      return web3Provider;
    },
  },
  actions: {
    async setAlreadyConnectedWallet() {
      console.log("Set already connected Wallet:");
      const chainId = this.web3Onboard?.connectedChain?.id || "";
      await this.setActiveChain(chainId);
    },
    async addNewNetwork(chainId: ChainId) {
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
    checkConnection() {
      return this.connectedWalletWeb3?.eth.getBlockNumber();
    },
    async switchNetwork(chainId: ChainId) {
      this.isSwitchingNetworks = true;
      let errorToThrow;

      try {
        if (this.connectedWallet) {
          // Ask the connected user to switch network.
          await this.setActiveChain(chainId);
        }

        // Test connection, outer catch block will except exception.
        try {
          await this.checkConnection();
        } catch (e: any) {
          this.toastStore.errorToast(
            "Looks like there are RPC connection problems.",
          );
        }
      } catch (error: any) {
        console.log("caught error for no network added", error)
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
    async setActiveChain(chainId: ChainId): Promise<void> {
      // If the user is currently on a different
      // network, ask him to switch it.
      if (chainId !== this.connectedWalletChainId) {
        console.log("REQUEST switch network in accountStore")
        await this.connectedWallet?.provider?.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId,
            },
          ],
        });
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
    },
  },
});
