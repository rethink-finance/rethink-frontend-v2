import GovernableFund from "../../assets/contracts/GovernableFund.json";
import { useAccountsStore } from "~/store/modules/accounts.store";
import type IFund from "~/types/fund";

interface IState {
  abi: Record<string, any>;
  address: Record<string, any>;
  apy: Record<string, any>;
  contract: Record<string, any>;
  userBalance: Record<string, any>;
  fund: Record<string, IFund>;
  userFundUsdValue: Record<string, any>;
  selectedFundAddress: string;
}

export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    abi: {},
    address: {},
    apy: {},
    contract: {},
    userBalance: {},
    fund: {},
    userFundUsdValue: {},
    selectedFundAddress: "N/A",
  }),
  getters: {
    accountsStore(): any {
      return useAccountsStore();
    },
    web3(): any {
      return this.accountsStore.web3;
    },
    getApy(state: IState): string {
      return state.apy?.[state.selectedFundAddress];
    },
    getSelectedFundAddress(state: IState) {
      return state.selectedFundAddress;
    },
    geFundAbi(state: IState) {
      return state.abi?.[state.selectedFundAddress];
    },
    getFundAddress(state: IState) {
      return state.address?.[state.selectedFundAddress];
    },
    getFundContract(state: IState) {
      return state.contract?.[state.selectedFundAddress];
    },
    getUserFundUsdValue(state: IState) {
      return state.userFundUsdValue?.[state.selectedFundAddress];
    },
  },
  actions: {
    fetchContract() {
      const web3 = this.web3;
      // let chainIdDec = parseInt(rootState.accounts.chainId);
      const address = this.selectedFundAddress;

      const contract = new web3.eth.Contract(GovernableFund.abi, address);
      this.setContract(contract);
      this.setAbi(GovernableFund.abi);
    },
    fetchUserBalance() {
      if (!this.contract) {
        this.fetchContract();
      }

      // let activeAccount = rootState.accounts.activeAccount;
      const balanceWei = this.fund[this.selectedFundAddress].user_fund_balance; // await state.contract[state.selectedFundAddress].methods.balanceOf(activeAccount).call();

      const web3 = this.web3;
      const balance = web3.utils.fromWei(balanceWei, "ether");

      this.setUserFundBalance(balance);
    },
    fetchUserFundUsdValue() {
      if (!this.contract) {
        this.fetchContract();
      }

      // let activeAccount = rootState.accounts.activeAccount;

      let balanceWei = "0";
      try {
        balanceWei = this.fund[this.selectedFundAddress].user_fund_usd_value; // await state.contract[state.selectedFundAddress].methods.valueOf(activeAccount).call();
      } catch (e) {
        console.error(
          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... " +
            "division by 0' error.",
        );
      }

      const web3 = this.web3;
      const value = web3.utils.fromWei(balanceWei, "ether");

      this.setUserFundUsdValue(value);
    },
    storeAbi() {
      this.setAbi(GovernableFund.abi);
    },
    storeAddress() {
      // let chainIdDec = parseInt(rootState.accounts.chainId);

      this.setAddress(this.selectedFundAddress);
    },

    // Mutation
    setAbi(abi: any) {
      this.abi[this.selectedFundAddress] = abi;
    },
    setAddress(address: string) {
      this.address[this.selectedFundAddress] = address;
    },
    setContract(_contract: any) {
      this.contract[this.selectedFundAddress] = _contract;
    },
    setFundData(fundAddr: string, fundData: IFund) {
      this.fund[fundAddr] = fundData;
    },
    setUserFundBalance(balance: string) {
      this.userBalance[this.selectedFundAddress] = balance;
    },
    setUserFundUsdValue(value: string) {
      this.userFundUsdValue[this.selectedFundAddress] = value;
    },
    setSelectedFundAddress(address: string) {
      this.selectedFundAddress = address;
    },
  },
});
