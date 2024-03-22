import { ethers } from "ethers";
import { defineStore } from "pinia";
import ContractJson from "~/assets/contracts/ERC20Mock.json";
import addresses from "~/assets/contracts/addresses.json";
import { useAccountsStore } from "~/store/accounts.store";
import { useFundStore } from "~/store/fund.store";
import type ContractAddresses from "~/types/contract_addresses";
const contractAddresses: ContractAddresses = addresses;
const ContractName = "DAI";

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

export const useDaiStore = defineStore("dai", {
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
    getDaiDecimals: (state) => state.decimals,
    getDaiAbi: (state) => state.abi,
    getDaiAddress: (state) => state.address,
    getDaiContract: (state) => state.contract,
    getFundDaiAllowance: (state) => state.fundAllowance,
    getUserDaiBalance: (state) => state.userBalance,
    usesPermitDai: (state) => state.permit,
  },
  actions: {
    async fetchContract() {
      try {
        const accountsStore = useAccountsStore();
        if (!accountsStore.isConnected) return;

        const chainId = accountsStore.getChainId;
        if (!chainId) throw new Error("Chain ID not found");
        const address = contractAddresses[ContractName][chainId] as string;
        console.log("fetching contract", address);
        // const provider = new ethers.InfuraProvider(chainId);
        // const contract = new Contract(address, ContractJson.abi, provider);
        const signer = await accountsStore.ethersProvider?.getSigner();
        const contract = new ethers.Contract(address, ContractJson.abi, signer);
        this.contract = contract;
        console.log("DAI contract", this.contract);
        if(!this.contract) throw new Error(`Failed to fetch ${ContractName} contract`);
        else console.log(`Successfuly fetched ${ContractName} contract`);
      } catch (error:any) {
        throw new Error(`ERROR in ${ContractName} store fetchContract method: `,error);
      }
    },
    async fetchFundAllowance() {
      try {
        console.log("fetching fund allowance");
        if (!this.contract) {
          await this.fetchContract();
        }
        const accountsStore = useAccountsStore();
        const fundStore = useFundStore();
        const userAddress = accountsStore.activeAccount?.address;
        const fundAddress = fundStore.getFundAddress;

        if (userAddress && fundAddress && this.contract) {
          const allowanceWei = await this.contract.allowance(userAddress, fundAddress);
          const allowance = ethers.formatEther(allowanceWei);
          this.fundAllowance = parseFloat(allowance);
        }
        console.log(`Fund ${ContractName} allowance: ${this.fundAllowance}`);
      } catch (error:any) {
        throw new Error(`ERROR in ${ContractName} store fetchFundAllowance method: `,error);
      }

    },
    async fetchUserBalance() {
      try {
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
        console.log(`User ${ContractName} balance: ${this.userBalance}`);
      } catch (error:any) {
        throw new Error(`ERROR in ${ContractName} store fetchUserBalance method: `,error);
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
