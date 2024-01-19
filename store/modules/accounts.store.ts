import Web3 from "web3";
import type { RegisteredSubscription } from "web3-eth";
import Web3Modal from "web3modal";
import { useFundStore } from "~/store/modules/fund.store";

interface IState {
  activeAccount: string;
  activeBalance: number | bigint;
  chainId?: string;
  chainName: string;
  web3?: Web3<RegisteredSubscription> | null;
  isConnected: boolean;
  providerW3m: any | null; // Specify the type if known
  web3Modal?: any; // Specify the type if known
  supportedChains: string[];
  lastSelectedTradePair: string | null;
  lastSelectedTradeMaturity: string | null;
  lastSelectedTradeType: string | null;
  lastSelectedTradeSide: string | null;
}

export const useAccountsStore = defineStore({
  id: "accounts",
  state: (): IState => ({
    activeAccount: "",
    activeBalance: 0,
    chainId: undefined,
    chainName: "",
    web3: null,
    isConnected: false,
    providerW3m: null, // this is "provider" from Web3Modal
    web3Modal: undefined,
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
    getActiveAccount(state): string {
      if (!state.activeAccount && process.client) {
        return process.client ? window.ethereum.selectedAddress : null;
      }

      return state.activeAccount;
    },
    getActiveBalanceWei(state) {
      return state.activeBalance;
    },
    getActiveBalanceEth(state) {
      return state?.web3?.utils.fromWei(this.activeBalance, "ether");
    },
    getChainId(state) {
      return state.chainId;
    },
    getChainName(state) {
      return state.chainName;
    },
    getLastSelectedTradePair(state) {
      return state.lastSelectedTradePair;
    },
    getLastSelectedTradeMaturity(state) {
      return state.lastSelectedTradeMaturity;
    },
    getLastSelectedTradeType(state) {
      return state.lastSelectedTradeType;
    },
    getLastSelectedTradeSide(state) {
      return state.lastSelectedTradeSide;
    },
    getSupportedChains(state) {
      return state.supportedChains;
    },
    getWeb3(state) {
      if (state.web3) {
        return state.web3;
      }
      return new Web3(Web3.givenProvider);
    },
    getWeb3Modal(state) {
      return state.web3Modal;
    },
    isCurrentChainSupported(state) {
      return state.supportedChains.includes(state.chainName);
    },
    isUserConnected(state) {
      return state.isConnected;
    },
  },
  actions: {
    async initWeb3Modal() {
      const providerOptions = {
        // MetaMask is enabled by default
        // Find other providers here: https://github.com/Web3Modal/web3modal/tree/master/docs/providers
        // burnerconnect: {
        //   package: BurnerConnectProvider, // required
        // },
        // authereum: {
        //   package: Authereum, // required
        // },
        // walletconnect: {
        //   package: WalletConnectProvider, // required
        //   options: {
        //     infuraId: "INFURA_ID", // required
        //   },
        // },
        // trezor: {
        //   package: TrezorProvider,
        // },
        // ledger: {
        //   package: loadConnectKit, // required
        //   opts: {
        //     chainId: 1, // defaults to 1
        //     infuraId: "INFURA_ID", // required if no rpc
        //     rpc: {
        //       // required if no infuraId
        //       1: "INSERT_MAINNET_RPC_URL",
        //       137: "INSERT_POLYGON_RPC_URL",
        //       // ...
        //     },
        //   },
        // },
        // coinbasewallet: {
        //   package: CoinbaseWalletSDK, // Required
        //   options: {
        //     appName: "ReThink Finance frontend", // Required
        //     infuraId: "INFURA_ID", // Required
        //     rpc: "", // Optional if `infuraId` is provided; otherwise it's required
        //     chainId: 1, // Optional. It defaults to 1 if not provided
        //     darkMode: true, // Optional. Use dark theme, defaults to false
        //   },
        // },
      };

      const w3mObject = new Web3Modal({
        cacheProvider: true, // optional
        providerOptions, // required
      });

      try {
        // This setting will get deprecated soon. Setting it to false removes a warning from the console.
        if (process.client) window.ethereum.autoRefreshOnNetworkChange = false;
      } catch (err: any) {
        console.log(err.message);
      }

      // if the user is flagged as already connected, automatically connect back to Web3Modal
      if (process.client && localStorage.getItem("isConnected") === "true") {
        const providerW3m = await w3mObject.connect();
        this.setIsConnected(true);

        this.activeAccount = window.ethereum.selectedAddress;
        this.setChainData(window.ethereum.chainId);
        this.setWeb3Provider(providerW3m);
        this.fetchActiveBalance();
      }

      this.setWeb3ModalInstance(w3mObject);
    },

    async connectWeb3Modal() {
      if (!this.web3Modal) return;
      const providerW3m = await this.web3Modal.connect();
      this.setIsConnected(true);

      this.activeAccount = window.ethereum.selectedAddress;
      this.setChainData(window.ethereum.chainId);
      this.setWeb3Provider(providerW3m);
      this.fetchActiveBalance();
    },
    disconnectWeb3Modal() {
      this.disconnectWallet();
      this.setIsConnected(false);
    },
    ethereumListener() {
      // dispatch("router/push", "/testpage");
      try {
        if (process.client || window)
          window.ethereum.on("accountsChanged", (accounts: any[]) => {
            if (this.isConnected) {
              this.activeAccount = accounts[0];
              this.setWeb3Provider(this.providerW3m);
              this.fetchActiveBalance();
            }
          });
      } catch (err: any) {
        console.log(err.message);
      }

      try {
        if (process.client || window)
          window.ethereum.on("chainChanged", (chainId: string) => {
            this.setChainData(chainId);
            this.setWeb3Provider(this.providerW3m);
            this.fetchActiveBalance();
          });
      } catch (err: any) {
        console.log(err.message);
      }
    },

    async fetchActiveBalance() {
      const balance = await this?.web3?.eth.getBalance(this.activeAccount);
      this.activeBalance = balance ?? 0;
    },
    async disconnectWallet() {
      this.activeAccount = "";
      this.activeBalance = 0;
      this.web3 = null;
      if (this.providerW3m.close && this.providerW3m !== null) {
        await this.providerW3m.close();
      }
      this.providerW3m = null;
      await this.web3Modal.clearCachedProvider();

      // window.location.href = '../'; // redirect to the Main page
      // router.push({ name: "home" });
      // dispatch("router/push", "/");
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
    setWeb3Provider(providerW3m: any) {
      this.providerW3m = providerW3m;
      this.web3 = new Web3(providerW3m);
    },
    setIsConnected(isConnected: boolean) {
      this.isConnected = isConnected;
      // add to persistent storage so that the user can be logged back in when revisiting website
      localStorage.setItem("isConnected", isConnected.toString());
    },
    setWeb3ModalInstance(w3mObject: any) {
      this.web3Modal = w3mObject;
    },
  },
});
