import { ethers } from "ethers";
import { defineStore } from "pinia";
import ContractJson from "~/assets/contracts/ERC20Mock.json";
import addresses from "~/assets/contracts/addresses.json";
import { useAccountsStore } from "~/store/accounts.store";
import type ContractAddresses from "~/types/contract_addresses";
const contractAddresses: ContractAddresses = addresses;
const ContractName = "AVAX";

interface IState {
  abi: any;
  address: string | null;
  contract: ethers.Contract | null;
  decimals: number;
  fundAllowance: number;
  exchangeAllowance: number;
  permit: boolean;
  userBalance: string | null;
}

export const useAvaxStore = defineStore("avax", {
  state: (): IState => ({
    abi: null,
    address: null,
    contract: null,
    decimals: 18,
    fundAllowance: 0,
    exchangeAllowance: 0,
    permit: true,
    userBalance: null,
  }),
  getters: {
    getAvaxDecimals: (state) => state.decimals,
    getAvaxAbi: (state) => state.abi,
    getAvaxAddress: (state) => state.address,
    getAvaxContract: (state) => state.contract,
    getFundAvaxAllowance: (state) => state.fundAllowance,
    getUserAvaxBalance: (state) => state.userBalance,
    usesPermitAvax: (state) => state.permit,
  },
  actions: {
    fetchContract() {
      const accountsStore = useAccountsStore();
      if (!accountsStore.isConnected) return;

      const chainId = accountsStore.chainId;
      if (!chainId) return console.error("Chain ID not found");
      const address = contractAddresses[ContractName][chainId] as string;
      const provider = new ethers.InfuraProvider(chainId);
      const contract = new ethers.Contract(address, ContractJson.abi, provider);
      this.contract = contract;
    },
    async fetchFundAllowance() {
      if (!this.contract) {
        await this.fetchContract();
      }

      const accountsStore = useAccountsStore();
      const userAddress = accountsStore.activeAccount?.address;
      const fundAddress = accountsStore.fundStore.selectedFundAddress;

      if (userAddress && fundAddress && this.contract) {
        const allowanceWei = await this.contract.allowance(userAddress, fundAddress);
        const allowance = ethers.formatEther(allowanceWei);
        this.fundAllowance = parseFloat(allowance);
      }
    },
    async fetchUserBalance() {
      if (!this.contract) {
        await this.fetchContract();
      }

      const accountsStore = useAccountsStore();
      const address = accountsStore.activeAccount?.address;

      if (address && this.contract) {
        const balanceWei = await this.contract.balanceOf(address);
        const balance = ethers.formatEther(balanceWei);
        this.userBalance = balance;
      }
    },
    storeAbi() {
      this.abi = ContractJson.abi;
    },
    storeAddress() {
      const accountsStore = useAccountsStore();
      const chainId = accountsStore.chainId;
      if (!chainId) return console.error("Chain ID not found");
      this.address = contractAddresses[ContractName][chainId] as string;
    },
  },
});
