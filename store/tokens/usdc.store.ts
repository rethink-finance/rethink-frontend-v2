import { ethers } from "ethers";
import { defineStore } from "pinia";
import ContractJson from "~/assets/contracts/ERC20Mock.json";
import addresses from "~/assets/contracts/addresses.json";
import { useAccountsStore } from "~/store/accounts.store";
import type ContractAddresses from "~/types/contract_addresses";

const ContractName = "USDC";

const contractAddresses: ContractAddresses = addresses;

interface IState {
  decimals: number;
  fundAllowance: number;
  permit: boolean;
  contract: ethers.Contract | null;
  userBalance: string;
}

export const useUsdcStore = defineStore("usdc", {
  state: (): IState => ({
    decimals: 6,
    fundAllowance: 0,
    permit: true,
    contract: null,
    userBalance: "0",
  }),
  getters: {
    getFundUsdcAllowance: (state) => state.fundAllowance,
    getUsdcDecimals: (state) => state.decimals,
    getUsdcContract: (state) => state.contract,
    getUserUsdcBalance: (state) => state.userBalance,
    usesPermitUsdc: (state) => state.permit,
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
        if(!this.contract) throw new Error(`Failed to fetch ${ContractName} contract`);
        else console.log(`Successfuly fetched ${ContractName} contract`);
      } catch (error:any) {
        throw new Error(`ERROR in ${ContractName} store fetchContract method: `,error);
      }
    },
    async fetchUserFundAllowance() {
      try {
        if (!this.contract) {
          await this.fetchContract();
        }
        const accountsStore = useAccountsStore();
        const userAddress = accountsStore.activeAccount?.address;
        const fundAddress = accountsStore.fundStore.selectedFundAddress;

        if (userAddress && fundAddress && this.contract) {
          const allowanceWei = await this.contract.allowance(userAddress, fundAddress);
          const allowance = ethers.formatUnits(allowanceWei, "mwei");
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
          const balance = ethers.formatUnits(balanceWei, "mwei");
          this.userBalance = balance;
        }
        console.log(`User ${ContractName} balance: ${this.userBalance}`);
      } catch (error:any) {
        throw new Error(`ERROR in ${ContractName} store fetchUserBalance method: `,error);
      }

    },
  },
});
