import { defineStore } from "pinia";
import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import { Web3 } from "web3";
import { useWeb3Store } from "~/store/web3.store";
import type INetwork from "~/types/network";

interface IState {
  chainId?: string;
  chainName: string;
  chainIcon: string;
  chainNativeToken: string;
  web3Onboard?: any;
  networks: Record<string, INetwork>;
}


export const useAccountsStore = defineStore("accounts", {
  state: (): IState => ({
    chainId: undefined,
    chainName: "",
    chainIcon: "",
    chainNativeToken: "",
    web3Onboard: undefined as any | undefined,
    networks: {
      // "0x2a": {
      //   chainId: "0x2a",
      //   chainName: "Kovan Testnet",
      //   chainNativeToken: "eth",
      //   chainIcon: "kovan",
      // },
      "0x89": {
        chainId: "0x89",
        chainName: "Polygon",
        chainNativeToken: "matic",
        chainIcon: "cryptocurrency-color:matic",
      },
      // "0x13881": {
      //   chainId: "0x13881",
      //   chainName: "Mumbai",
      //   chainNativeToken: "matic",  // Mumbai is the testnet for Polygon, so it uses the same token type as Polygon's mainnet.
      //   chainIcon: "mumbai",
      // },
      // "0xa869": {
      //   chainId: "0xa869",
      //   chainName: "Fuji",
      //   chainNativeToken: "avax",  // Fuji is the testnet for Avalanche.
      //   chainIcon: "fuji",
      // },
      // "0x1e15": {
      //   chainId: "0x1e15",
      //   chainName: "Canto Testnet",
      //   chainNativeToken: "canto", // Assuming Canto uses its own native token, typically denoted by the network name.
      //   chainIcon: "canto",
      // },
      "0x66eed": {
        chainId: "0x66eed",
        chainName: "Arbitrum One",
        chainNativeToken: "arb1",  // Arbitrum One uses Ethereum's ETH as it is a Layer 2 solution leveraging Ethereum's security.
        chainIcon: "arbitrum1",
      },
      // "0x5": {
      //   chainId: "0x5",
      //   chainName: "Goerli Testnet",
      //   chainNativeToken: "eth",  // Goerli is another Ethereum testnet, so it uses ETH.
      //   chainIcon: "goerli",
      // },
    },
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
    setActiveChain(chainId?: string): void {
      if (!chainId) {
        chainId = this.web3Onboard?.connectedChain?.id;
      }

      this.chainId = chainId;
      const chain: any = this.networks[chainId || ""];
      this.chainName = chain?.chainName ?? "";
      this.chainNativeToken = chain?.chainNativeToken ?? "";
      this.chainIcon = chain?.chainIcon ?? "";

      console.log("setActiveChain id: ", this.chainId, " name: ", this.chainName);
    },
    async connectWallet() {
      // Connect to the web3-onboard.
      await this.web3Onboard?.connectWallet();
      console.log("Wallet Object:", this.web3Onboard);
      this.setActiveChain();
      if (this.connectedWallet) {
        this.web3Store.web3 = new Web3(this.connectedWallet.provider);
      }
    },
    async disconnectWallet() {
      const { provider, label } = this.web3Onboard?.connectedWallet || {}
      if (provider && label) {
        await this.web3Onboard?.disconnectWallet({ label })
      }

      // Reset to default provider in web3Store.
      this.web3Store.init();

      // this.activeBalance = 0;
    },
    setAlreadyConnectedWallet() {
      console.log("Already connected Wallet Object:", this.web3Onboard);
      this.setActiveChain();

      if (!this.chainId) {
        console.log("Chain ID not found");
        return;
      }
      if (this.connectedWallet) {
        this.web3Store.web3 = new Web3(this.connectedWallet.provider);
      }
    },
  },
});
