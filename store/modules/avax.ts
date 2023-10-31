import ContractJson from "../../assets/contracts/ERC20Mock.json";
import addresses from "../../assets/contracts/addresses.json";

const ContractName = "AVAX";

const state = {
  abi: null,
  address: null,
  contract: null,
  decimals: 18,
  lpAllowance: 0, // liquidity pool contract Avax allowance for current user
  exchangeAllowance: 0, // exchange contract dai allowance for current user
  permit: true, // does this token have the permit() method?
  userBalance: null,
};

const getters = {
  getAvaxDecimals(state) {
    return state.decimals;
  },
  getAvaxAbi(state) {
    return state.abi;
  },
  getAvaxAddress(state) {
    return state.address;
  },
  getAvaxContract(state) {
    return state.contract;
  },
  getFundAvaxAllowance(state) {
    return state.lpAllowance;
  },
  getUserAvaxBalance(state) {
    return state.userBalance;
  },
  usesPermitAvax(state) {
    return state.permit;
  },
};

const actions = {
  async fetchContract({ commit, rootState }) {
    let web3 = rootState.accounts.web3;
    let chainIdDec = parseInt(rootState.accounts.chainId);
    let address = addresses[ContractName][chainIdDec];
    let contract = new web3.eth.Contract(ContractJson.abi, address);
    commit("setContract", contract);
  },
  async fetchFundllowance({ commit, dispatch, state, rootState }) {
    if (!state.contract) {
      dispatch("fetchContract");
    }

    let userAddress = rootState.accounts.activeAccount;
    let lpAddress = rootState.liquidityPool.selectedPoolAddress;

    let allowanceWei = await state.contract.methods
      .allowance(userAddress, lpAddress)
      .call();

    let web3 = rootState.accounts.web3;
    let allowance = web3.utils.fromWei(allowanceWei, "ether");

    commit("setFundAllowance", allowance);
  },
  async fetchUserBalance({ commit, dispatch, state, rootState }) {
    if (!state.contract) {
      dispatch("fetchContract");
    }

    let address = rootState.accounts.activeAccount;
    let balanceWei = await state.contract.methods.balanceOf(address).call();

    let web3 = rootState.accounts.web3;
    let balance = web3.utils.fromWei(balanceWei, "ether");

    commit("setUserBalance", balance);
  },
  storeAbi({ commit }) {
    commit("setAbi", ContractJson.abi);
  },
  storeAddress({ commit, rootState }) {
    let chainIdDec = parseInt(rootState.accounts.chainId);
    commit("setAddress", addresses[ContractName][chainIdDec]);
  },
};

const mutations = {
  setAbi(state, abi) {
    state.abi = abi;
  },
  setAddress(state, address) {
    state.address = address;
  },
  setContract(state, _contract) {
    state.contract = _contract;
  },
  setFundAllowance(state, allowance) {
    state.fundAllowance = allowance;
  },
  setUserBalance(state, balance) {
    state.userBalance = balance;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
