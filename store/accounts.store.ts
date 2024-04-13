import type { Account, WalletState } from "@web3-onboard/core/dist/types";
import { Web3 } from "web3";
import { useWeb3Store } from "~/store/web3.store";

interface IState {
  chainId?: string;
  chainName: string;
  web3Onboard?: any;
  supportedChains: string[];
}

export const useAccountsStore = defineStore("accounts", {
  state: (): IState => ({
    chainId: undefined,
    chainName: "",
    web3Onboard: undefined as any | undefined,
    supportedChains: [
      "Kovan Testnet",
      "Polygon PoS Chain",
      "Local Testnet",
      "Avalanche Fuji Testnet",
      "Polygon Mumbai Testnet",
      "Canto Testnet",
      "Arbitrum Goerli",
      "Goerli",
    ],
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
    isCurrentChainSupported(state): boolean {
      return state.supportedChains?.includes(state.chainName);
    },
    getChainId(state): string {
      return state.chainId ?? "";
    },
  },
  actions: {
    setActiveChain(): void {
      const activeChain = this.web3Onboard?.connectedChain;
      this.chainId = activeChain?.id;
    },
    async connectWallet() {
      // Connect to the web3-onboard.
      await this.web3Onboard?.connectWallet();
      console.log("Wallet Object:", this.web3Onboard);
      this.setActiveChain();

      if (!this.chainId){
        console.log("Chain ID not found");
        return;
      }
      this.setChainData(this.chainId);
      console.log("Connected to chain:", this.chainName);
      console.log("Chain ID:", this.chainId);
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
    // async fetchActiveBalance() {
    //   const balance = await this.ethersProvider?.getBalance(this.activeAccount.address);
    //   this.activeBalance = balance ?? 0;
    // },
    setChainData(chainId: string) {
      this.chainId = chainId;

      switch (chainId) {
        case "0x2a":
          this.chainName = "Kovan";
          break;
        case "0x89":
          this.chainName = "Polygon";
          break;
        case "0xa868":
          this.chainName = "Localhost";
          break;
        case "0x13881":
          this.chainName = "Mumbai";
          break;
        case "0xa869":
          this.chainName = "Fuji";
          break;
        case "0x1e15":
          this.chainName = "Canto Testnet";
          break;
        case "0x66eed":
          this.chainName = "Arbitrum Goerli";
          break;
        case "0x5":
          this.chainName = "Goerli";
          break;
        default:
          this.chainName = "";
          break;
      }
      console.log("setChainData: ", chainId, this.chainName);
    },
    setAlreadyConnectedWallet() {
      console.log("Already connected Wallet Object:", this.web3Onboard);
      this.setActiveChain();

      if (!this.chainId) {
        console.log("Chain ID not found");
        return;
      }
      this.setChainData(this.chainId);

      console.log("Connected to chain:", this.chainName);
      console.log("Chain ID:", this.chainId);
      if (this.connectedWallet) {
        this.web3Store.web3 = new Web3(this.connectedWallet.provider);
      }
      // if (this.ethersProvider) {
      //   // const activeAccount = this.connectedWallet.accounts[0];
      //   // this.activeBalance = activeAccount.balance;
      //   await this.fetchActiveBalance();
      // }
    },
  },
});
