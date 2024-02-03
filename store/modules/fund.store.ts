import GovernableFund from "@/assets/contracts/GovernableFund.json";
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
    getSelectedFundAddress(state: IState): string {
      return state.selectedFundAddress;
    },
    geFundAbi(state: IState): any {
      return state.abi?.[state.selectedFundAddress];
    },
    getFundAddress(state: IState): string {
      return state.address?.[state.selectedFundAddress];
    },
    getFundContract(state: IState): any {
      return state.contract?.[state.selectedFundAddress];
    },
    getUserFundUsdValue(state: IState): string {
      return state.userFundUsdValue?.[state.selectedFundAddress];
    },
  },
  actions: {
    fetchContract() {
      const web3 = this.web3;
      // let chainIdDec = parseInt(rootState.accounts.chainId);
      const address = this.selectedFundAddress;

      this.contract = new web3.eth.Contract(GovernableFund.abi, address);
      this.abi = GovernableFund.abi;
    },
    fetchUserBalance() {
      if (!this.contract) {
        this.fetchContract();
      }

      // let activeAccount = rootState.accounts.activeAccount;
      const balanceWei = this.fund[this.selectedFundAddress].user_fund_balance; // await state.contract[state.selectedFundAddress].methods.balanceOf(activeAccount).call();

      const web3 = this.web3;
      const balance = web3.utils.fromWei(balanceWei, "ether");

      // this.userFundBalance = balance;
    },
    fetchUserFundUsdValue() {
      if (!this.contract) {
        this.fetchContract();
      }

      // let activeAccount = this.accountsStore.activeAccount;

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
      this.userFundUsdValue = web3.utils.fromWei(balanceWei, "ether");
    },
  },
});
