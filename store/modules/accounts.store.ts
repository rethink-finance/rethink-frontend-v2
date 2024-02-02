import type { WalletState } from "@web3-onboard/core/dist/types";
import type { Account } from "bnc-sdk";
import { ethers } from "ethers";
import { useFundStore } from "~/store/modules/fund.store";

interface IState {
  // activeAccount: string;
  activeBalance: number | bigint;
  chainId?: string;
  chainName: string;
  web3?: any;
  web3Onboard?: any;
  isConnected: boolean;
  ethersProvider: any; // Specify the type if known
  supportedChains: string[];
  lastSelectedTradePair: string | null;
  lastSelectedTradeMaturity: string | null;
  lastSelectedTradeType: string | null;
  lastSelectedTradeSide: string | null;
}
interface IGetters {
    activeAccount: Account
}

export const useAccountsStore = defineStore("accounts", {
  state: (): IState => ({
    activeBalance: 0,
    chainId: undefined,
    chainName: "",
    web3: undefined,
    web3Onboard: undefined,
    isConnected: false,
    ethersProvider: undefined,
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
    activeAccount(): Account {
      return this.web3Onboard?.connectedWallet?.accounts[0];
    },
    getActiveBalanceWei(state) {
      return state.activeBalance;
    },
    getActiveBalanceEth(state) {
      return state?.web3?.utils.fromWei(this.activeBalance, "ether");
    },
    isCurrentChainSupported(state) {
      return state.supportedChains.includes(state.chainName);
    },
  },
  actions: {
    async connectWallet() {
      // Connect to the web3-onboard.
      await this.web3Onboard?.connectWallet();
      this.isConnected = true;

      // TODO Would be better to just save the whole account as an object.
      const connectedWallet = this.web3Onboard.connectedWallet;
      const activeAccount = connectedWallet.accounts[0];
      this.activeBalance = activeAccount.balance;

      const activeChain = this.web3Onboard.connectedChain;
      this.chainId = activeChain.id;
      this.chainName = activeChain.namespace;

      if (connectedWallet?.provider) {
        this.setEthersProvider(connectedWallet?.provider);

        if (!this.activeBalance) {
          this.fetchActiveBalance();
        }
      }
    },
    async disconnectWallet() {
      const { provider, label } = this.web3Onboard?.connectedWallet || {}
      if (provider && label) {
        await this.web3Onboard?.disconnectWallet({ label })
      }
      this.isConnected = false;
      // this.activeAccount = "";
      this.activeBalance = 0;
    },
    async fetchActiveBalance() {
      const balance = await this.ethersProvider.getBalance(this.activeAccount.address);
      console.log("balance: " + balance)

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
    setEthersProvider(ethersProvider: any) {
      this.ethersProvider = ethersProvider;
      this.web3 = new ethers.BrowserProvider(ethersProvider, "any");
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
