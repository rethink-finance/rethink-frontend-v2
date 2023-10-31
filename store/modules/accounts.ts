import Web3Modal from "web3modal";
import Web3 from "web3";
// import BurnerConnectProvider from "@burner-wallet/burner-connect-provider";
// import Authereum from "authereum";
// import WalletConnectProvider from "@walletconnect/web3-provider";
// import CoinbaseWalletSDK from "@coinbase/wallet-sdk";
// import { loadConnectKit } from "@ledgerhq/connect-kit-loader";
// import TrezorProvider from "@web3modal/trezor-provider";
// import router from "@/router";

const state = {
  activeAccount: null,
  activeBalance: 0,
  chainId: null,
  chainName: null,
  web3: null,
  isConnected: false,
  providerW3m: null, // this is "provider" from Web3Modal
  web3Modal: null,
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
};

const getters = {
  getActiveAccount(state) {
    if (!state.activeAccount && process.client) {
      return process.client ? window.ethereum.selectedAddress : null;
    }

    return state.activeAccount;
  },
  getActiveBalanceWei(state) {
    return state.activeBalance;
  },
  getActiveBalanceEth(state) {
    return state.web3.utils.fromWei(state.activeBalance, "ether");
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
    } else {
      return new Web3(Web3.givenProvider);
    }
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
};

const actions = {
  async initWeb3Modal({ commit }) {
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
    } catch (err) {
      console.log(err.message);
    }

    // if the user is flagged as already connected, automatically connect back to Web3Modal
    if (process.client && localStorage.getItem("isConnected") === "true") {
      let providerW3m = await w3mObject.connect();
      commit("setIsConnected", true);

      commit("setActiveAccount", window.ethereum.selectedAddress);
      commit("setChainData", window.ethereum.chainId);
      commit("setWeb3Provider", providerW3m);
      actions.fetchActiveBalance({ commit });
    }

    commit("setWeb3ModalInstance", w3mObject);
  },

  async connectWeb3Modal({ commit }) {
    let providerW3m = await state.web3Modal.connect();
    commit("setIsConnected", true);

    commit("setActiveAccount", window.ethereum.selectedAddress);
    commit("setChainData", window.ethereum.chainId);
    commit("setWeb3Provider", providerW3m);
    actions.fetchActiveBalance({ commit });
  },

  async disconnectWeb3Modal({ commit }) {
    commit("disconnectWallet");
    commit("setIsConnected", false);
  },

  async ethereumListener({ commit }) {
    dispatch("router/push", "/testpage");
    try {
      if (process.client || window)
        window.ethereum.on("accountsChanged", (accounts) => {
          if (state.isConnected) {
            commit("setActiveAccount", accounts[0]);
            commit("setWeb3Provider", state.providerW3m);
            actions.fetchActiveBalance({ commit });
          }
        });
    } catch (err) {
      console.log(err.message);
    }

    try {
      if (process.client || window)
        window.ethereum.on("chainChanged", (chainId) => {
          commit("setChainData", chainId);
          commit("setWeb3Provider", state.providerW3m);
          actions.fetchActiveBalance({ commit });
        });
    } catch (err) {
      console.log(err.message);
    }
  },

  async fetchActiveBalance({ commit }) {
    let balance = await state.web3.eth.getBalance(state.activeAccount);
    commit("setActiveBalance", balance);
  },
};

const mutations = {
  async disconnectWallet(state) {
    state.activeAccount = null;
    state.activeBalance = 0;
    state.web3 = null;
    if (state.providerW3m.close && state.providerW3m !== null) {
      await state.providerW3m.close();
    }
    state.providerW3m = null;
    await state.web3Modal.clearCachedProvider();

    // window.location.href = '../'; // redirect to the Main page
    // router.push({ name: "home" });
    dispatch("router/push", "/");
  },

  setActiveAccount(state, selectedAddress) {
    state.activeAccount = selectedAddress;
  },

  setActiveBalance(state, balance) {
    state.activeBalance = balance;
  },

  setChainData(state, chainId) {
    state.chainId = chainId;

    switch (chainId) {
      case "0x2a":
        state.chainName = "Kovan";
        break;
      case "0x89":
        state.chainName = "Polygon";
        break;
      case "0xa868":
        state.chainName = "Localhost";
        break;
      case "0x13881":
        state.chainName = "Mumbai";
        break;
      case "0xa869":
        state.chainName = "Fuji";
        break;
      case "0x1e15":
        state.chainName = "Canto Testnet";
        break;
      case "0x66eed":
        state.chainName = "Arbitrum Goerli";
        break;
      case "0x5":
        state.chainName = "Goerli";
        break;
      default:
        state.chainName = null;
        break;
    }
  },

  setLastSelectedTradePair(state, pair) {
    state.lastSelectedTradePair = pair;
  },

  setLastSelectedTradeMaturity(state, maturity) {
    state.lastSelectedTradeMaturity = maturity;
  },

  setLastSelectedTradeType(state, type) {
    state.lastSelectedTradeType = type;
  },

  setLastSelectedTradeSide(state, side) {
    state.lastSelectedTradeSide = side;
  },

  async setWeb3Provider(state, providerW3m) {
    state.providerW3m = providerW3m;
    state.web3 = new Web3(providerW3m);
  },

  setIsConnected(state, isConnected) {
    state.isConnected = isConnected;
    // add to persistent storage so that the user can be logged back in when revisiting website
    localStorage.setItem("isConnected", isConnected);
  },

  setWeb3ModalInstance(state, w3mObject) {
    state.web3Modal = w3mObject;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
