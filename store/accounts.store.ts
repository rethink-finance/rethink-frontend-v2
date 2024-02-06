import type { WalletState, Account } from "@web3-onboard/core/dist/types";
import { BrowserProvider, ethers } from "ethers";
import { useFundStore } from "~/store/fund.store";

interface IState {
  activeBalance: number | bigint;
  chainId?: string;
  chainName: string;
  web3Onboard?: any;
  supportedChains: string[];
  lastSelectedTradePair: string | null;
  lastSelectedTradeMaturity: string | null;
  lastSelectedTradeType: string | null;
  lastSelectedTradeSide: string | null;
}

export const useAccountsStore = defineStore("accounts", {
  state: (): IState => ({
    activeBalance: 0,
    chainId: undefined,
    chainName: "",
    web3Onboard: undefined,
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
    lastSelectedTradePair: null,
    lastSelectedTradeMaturity: null,
    lastSelectedTradeType: null,
    lastSelectedTradeSide: null,
  }),
  getters: {
    fundStore() {
      return useFundStore();
    },
    connectingWallet(): boolean {
      return this.web3Onboard?.connectingWallet ?? false;
    },
    connectedWallet(): WalletState {
      return this.web3Onboard?.connectedWallet;
    },
    isConnected(): boolean {
      return !!this.connectedWallet;
    },
    activeAccount(): Account {
      return this.web3Onboard?.connectedWallet?.accounts[0];
    },
    ethersProvider(): BrowserProvider | undefined{
      if (this.connectedWallet?.provider) {
        return new ethers.BrowserProvider(this.connectedWallet?.provider, "any");
      }
      return undefined
    },
    getActiveBalanceWei(state): number | bigint {
      return state.activeBalance;
    },
    // getActiveBalanceEth(state): string {
    //   return state?.web3?.utils.fromWei(this.activeBalance, "ether");
    // },
    isCurrentChainSupported(state): boolean {
      return state.supportedChains?.includes(state.chainName);
    },
  },
  actions: {
    async connectWallet() {
      // Connect to the web3-onboard.
      await this.web3Onboard?.connectWallet();

      const activeChain = this.web3Onboard.connectedChain;
      this.chainId = activeChain.id;
      this.chainName = activeChain.namespace;

      if (this.ethersProvider) {
        // Is this a cleaner Alternative?
        // const activeAccount = this.connectedWallet.accounts[0];
        // this.activeBalance = activeAccount.balance;
        await this.fetchActiveBalance();
      }
    },
    async disconnectWallet() {
      const { provider, label } = this.web3Onboard?.connectedWallet || {}
      if (provider && label) {
        await this.web3Onboard?.disconnectWallet({ label })
      }

      this.activeBalance = 0;
    },
    async fetchActiveBalance() {
      const balance = await this.ethersProvider?.getBalance(this.activeAccount.address);
      this.activeBalance = balance ?? 0;
    },
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
    },
  },
});

// Provide the type for your store
type MyStore = ReturnType<typeof useAccountsStore>;

// Provide the type for your store context
type MyStoreContext = {
    store: MyStore;
};

export type { MyStoreContext };
