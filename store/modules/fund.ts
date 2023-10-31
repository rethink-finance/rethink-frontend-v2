import GovernableFund from "../../assets/contracts/GovernableFund.json";

import addresses from "../../assets/contracts/addresses.json";

const state = {
  abi: { undefined: null },
  address: { undefined: null },
  apy: { undefined: null },
  contract: { undefined: null },
  userBalance: { undefined: null },
  fund: { undefined: null },
  userFundUsdValue: { undefined: null }, // USD value of the fund balance
  selectedFundAddress: "N/A",
};

const getters = {
  getApy(state) {
    return state.apy[state.selectedFundAddress];
  },
  getSelectedFundAddress(state) {
    return state.selectedFundAddress;
  },
  geFundAbi(state) {
    return state.abi[state.selectedFundAddress];
  },
  getFundAddress(state) {
    return state.address[state.selectedFundAddress];
  },
  getFundContract(state) {
    return state.contract[state.selectedFundAddress];
  },
  getUserFundUsdValue(state) {
    return state.userFundUsdValue[state.selectedFundAddress];
  },
  /// @dev: next key is a name duplicate, are they the same/different?
  // getUserFundUsdValue(state) {
  //   return state.userBalance[state.selectedFundAddress];
  // },
};

const actions = {
  async fetchContract({ commit, rootState }) {
    let web3 = rootState.accounts.web3;
    //let chainIdDec = parseInt(rootState.accounts.chainId);
    let address = state.selectedFundAddress;

    let contract = new web3.eth.Contract(GovernableFund.abi, address);
    commit("setContract", contract);
    commit("setAbi", GovernableFund.abi);
  },
  async fetchUserBalance({ commit, dispatch, state, rootState }) {
    if (!state.contract) {
      dispatch("fetchContract");
    }

    //let activeAccount = rootState.accounts.activeAccount;
    let balanceWei = state.fund[state.selectedFundAddress]["userFundBalance"]; //await state.contract[state.selectedFundAddress].methods.balanceOf(activeAccount).call();

    let web3 = rootState.accounts.web3;
    let balance = web3.utils.fromWei(balanceWei, "ether");

    commit("setUserFundBalance", balance);
  },
  async fetchUserFundUsdValue({ commit, dispatch, state, rootState }) {
    if (!state.contract) {
      dispatch("fetchContract");
    }

    //let activeAccount = rootState.accounts.activeAccount;

    let balanceWei = "0";
    try {
      balanceWei = state.fund[state.selectedFundAddress]["userFundUsdValue"]; //await state.contract[state.selectedFundAddress].methods.valueOf(activeAccount).call();
    } catch (e) {
      console.log(
        "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error."
      );
    }

    let web3 = rootState.accounts.web3;
    let value = web3.utils.fromWei(balanceWei, "ether");

    commit("setUserFundUsdValue", value);
  },
  storeAbi({ commit }) {
    commit("setAbi", GovernableFund.abi);
  },
  storeAddress({ commit }) {
    //let chainIdDec = parseInt(rootState.accounts.chainId);

    commit("setAddress", state.selectedFundAddress);
  },
};

const mutations = {
  setAbi(state, abi) {
    state.abi[state.selectedFundAddress] = abi;
  },
  setAddress(state, address) {
    state.address[state.selectedFundAddress] = address;
  },
  setContract(state, _contract) {
    state.contract[state.selectedFundAddress] = _contract;
  },
  setFundData(state, fundAddr, fundData) {
    state.fund[fundAddr] = fundData;
  },
  setUserFundBalance(state, balance) {
    state.userBalance[state.selectedFundAddress] = balance;
  },
  setUserFundUsdValue(state, value) {
    state.userFundUsdValue[state.selectedFundAddress] = value;
  },
  setSelectedFundAddress(state, address) {
    state.selectedFundAddress = address;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
