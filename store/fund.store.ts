import { BaseContract, ethers } from "ethers";
import { defineStore } from "pinia";
import { Contract } from "web3-eth-contract";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import { useAccountsStore } from "~/store/accounts.store";
import { PositionType } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import type IToken from "~/types/token";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import addressesJson from "~/assets/contracts/addresses.json";
import type INAVUpdate from "~/types/nav_update";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IPositionType from "~/types/position_type";
import ERC20 from "~/assets/contracts/ERC20.json";
import type IFundMetadata from "~/types/fund_metadata";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";

export interface FundContract extends BaseContract {
  requestDeposit: (amount: ethers.BigNumberish, options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  totalWithrawalBalance: (options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  revokeDepositWithrawal: (isDeposit: boolean, options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  deposit: (options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
  approve: (spender: string, amount: ethers.BigNumberish, options?: ethers.TransactionRequest) => Promise<ethers.ContractTransaction>;
}

const NAVDetailsJSON = {
  nav_liquid: `{
        "tokenPair": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
        "aggregatorAddress": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
        "functionSignatureWithEncodedInputs": null,
        "assetTokenAddress": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
        "nonAssetTokenAddress": "0xE3dc7cF9E64d81719F7C0B191425AB8369a9C75B",
        "isReturnArray": "false",
        "returnLength": "4",
        "returnIndex": "1",
        "pastNAVUpdateIndex": "0"
      }`,
  nav_illiquid: `{
        "tokenPair": "0xNewTokenPairForIlliquid",
        "aggregatorAddress": "0xNewAggregatorAddressForIlliquid",
        "functionSignatureWithEncodedInputs": "NewFunctionSignatureForIlliquid",
        "assetTokenAddress": "0xNewAssetTokenAddressForIlliquid",
        "nonAssetTokenAddress": "0xNewNonAssetTokenAddressForIlliquid",
        "isReturnArray": "true",
        "returnLength": "6",
        "returnIndex": "2",
        "pastNAVUpdateIndex": "1"
      }`,
};
const defaultFund: IFund = {
  address: "N/A",
  title: "N/A",
  subtitle: "N/A",
  chain: "N/A",
  avatarUrl: "https://api.lorem.space/image/ai?w=60&h=60",
  description: "N/A",
  governorAddress: "0x0",
  safeAddress: "0x0",
  inceptionDate: "N/A",
  aumValue: 0,
  cumulativeReturnPercent: 0,
  monthlyReturnPercent: 0,
  sharpeRatio: 0,
  userFundBalance: "N/A",
  userFundUsdValue: "N/A",
  nextSettlement: "N/A",
  positionTypes: [],
  cyclePendingRequests: [],
  fundToken: {} as IToken,
  denominationToken: {} as IToken,
  governorToken: {} as IToken,
  fundToDenominationExchangeRate: 0,
  netDeposits: "N/A",
  currentValue: "N/A",
  totalReturn: 0,
  delegatingAddress: "0x0",
  votingPower: "N/A",
  depositAddresses: [],
  managementAddresses: [],
  plannedSettlementCycle: "N/A",
  minLiquidAssetShare: "N/A",
  votingDelay: "N/A",
  votingPeriod: "N/A",
  proposalThreshold: "N/A",
  quorom: "N/A",
  lateQuorom: "N/A",
  navUpdates: [],
};


interface IState {
  fund: IFund;
  funds: IFund[];
  abi: Record<string, any>;
  address: Record<string, any>;
  apy: Record<string, any>;
  userBalance: Record<string, any>;
  userFundBalance: string;
  userFundUsdValue: string
  selectedFundAddress: string;
  fundsSettings: Record<string, IFundSettings>;
}


export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    fund: {} as IFund,
    funds: [] as IFund[],
    abi: {},
    address: {},
    apy: {},
    userBalance: {},
    userFundBalance: "",
    userFundUsdValue: "",
    selectedFundAddress: "N/A",
    fundsSettings: {} as Record<string, IFundSettings>,
  }),
  getters: {
    accountsStore(): any {
      return useAccountsStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): any {
      return this.web3Store.web3;
    },
    getFundAddress(state: IState): string {
      return state.address?.[state.selectedFundAddress];
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFundFactory> but
    // for now we don't have types for each contract made, should be done using typechain or some
    // other type generator from abi.
    fundFactoryContract(): Contract {
      const contractAddress = addresses[GovernableFundFactoryContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(GovernableFundFactory.abi, contractAddress)
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund> but
    fundContract(): Contract {
      const contractAddress = this.selectedFundAddress;
      return new this.web3.eth.Contract(GovernableFund.abi, contractAddress)
    },
  },
  actions: {
    async getFund(fundAddress: string) {
      /**
       * This function finds and returns fund in the funds array.
       */
      const fund = this.funds.find(f => f.address === fundAddress);
      // TODO then use:
      // const fund = this.fundsSettings[fundAddress];
      if (fund) {
        // TODO replace with this.fund = fund;
        this.fund = { ...this.fund, ...fund };
        this.selectedFundAddress = fundAddress;
        console.log("fund contract: ", this.fundContract);

        const fundSettings = await this.fundContract.methods.getFundSettings().call();
        console.log("fetched fundSettings: ", fundSettings)

        // Fetch inception date
        const fundStartTime = await this.fundContract.methods.getFundStartTime().call();
        const fundStartDate = new Date(Number(fundStartTime) * 1000);
        this.fund.inceptionDate = formatDate(fundStartDate);

        // Fetch metadata.
        const metaDataJson = await this.fundContract.methods.fundMetadata().call();
        if (metaDataJson) {
          const metaData: IFundMetadata = JSON.parse(metaDataJson);
          this.fund.description = metaData.description;
          this.fund.avatarUrl = metaData.photoUrl;
        }
      } else {
        console.error(`Fund not found with address: ${fundAddress}`);
      }
    },
    async fetchFunds() {
      /**
       * This function fetches all funds data from the GovernableFundFactory.
       * TODO: rename to fetch registered funds.
       */
      console.log("fetchFunds");
      const fundFactoryContract = this.fundFactoryContract;
      const fundsLength = await fundFactoryContract.methods.registeredFundsLength().call();

      const fundsInfo = await fundFactoryContract.methods.registeredFundsData(0, fundsLength).call();
      const fundAddresses: string[] = fundsInfo[0];

      // Reset funds as we will populate them with new data.
      this.funds = [];

      for (let i = 0; i < fundAddresses.length; i++) {
        const fundAddress: string = fundAddresses[i] as string;
        const fundSettings: Partial<IFundSettings> = { address: fundAddress };

        // Fetch Denomination/Base token symbol.
        // @dev: would be better to just have this available in the FundSettings data.
        const ERC20Contract = new this.web3.eth.Contract(ERC20, fundsInfo[1][i].baseToken);
        fundSettings.baseSymbol = await ERC20Contract.methods.symbol().call();

        // Directly iterate over the details object's entries.
        Object.entries(fundsInfo[1][i]).forEach(([key, value]) => {
          // Assume that every key in details corresponds to a valid key in IFundSettings.
          const detailKey = key as keyof IFundSettings;

          // Convert bigint values to strings, otherwise assign the value directly.
          // This approach skips checking if detailKey is explicitly part of fundSettings
          // since fundSettings is typed as Partial<IFundSettings> and initialized accordingly.
          fundSettings[detailKey] = typeof value === "bigint" ? value.toString() : value;
        });
        if (!this.fundsSettings[fundAddress]) {
          this.fundsSettings[fundAddress] = fundSettings as IFundSettings;
        }

        this.funds.push(
          {
            address: fundSettings.fundAddress || "",
            title: fundSettings.fundName || "N/A",
            subtitle: fundSettings.fundName || "N/A",
            description: fundSettings.fundName || "N/A",
            safeAddress: fundSettings.safe || "",
            governorAddress: fundSettings.governor || "",
            avatarUrl: "https://api.lorem.space/image/ai?w=60&h=60",
            fundToken: {
              symbol: fundSettings.fundSymbol || "N/A",
              address: fundSettings.fundAddress || "N/A",
              balance: 0,
            },
            denominationToken: {
              symbol: fundSettings.baseSymbol,
              address: fundSettings.baseToken,
              balance: 0,
            },
            governorToken: {
              symbol: "TODO", // TODO get governanceToken, same as getting baseToken symbol?
              address: fundSettings.governanceToken || "N/A",
              balance: 0,
            },
            chain: "",
            inceptionDate: "",
            aumValue: 0,
            cumulativeReturnPercent: 0,
            monthlyReturnPercent: 0,
            sharpeRatio: 0,
            userFundBalance: "",
            userFundUsdValue: "",
            nextSettlement: "",
            // TODO remove these position types, replace with []
            positionTypes: [
              {
                type: PositionType.NAVLiquid,
                value: 123,
              },
              {
                type: PositionType.NAVComposable,
                value: 78,
              },
              {
                type: PositionType.NAVNft,
                value: 287,
              },
              {
                type: PositionType.NAVIlliquid,
                value: 36,
              },
            ] as IPositionType[],
            cyclePendingRequests: [] as ICyclePendingRequest[],
            fundToDenominationExchangeRate: 0,

            // My Fund Positions
            netDeposits: "",
            currentValue: "",
            totalReturn: 0,
            delegatingAddress: "",
            votingPower: "",

            // Overview fields
            depositAddresses: [],
            managementAddresses: [],
            plannedSettlementCycle: "",
            minLiquidAssetShare: "",

            // Governance
            votingDelay: "",
            votingPeriod: "",
            proposalThreshold: "",
            quorom: "",
            lateQuorom: "",

            // NAV Updates
            navUpdates: [] as INAVUpdate[],
          } as IFund,
        )
      }
    },
    async fetchUserBalance() {
      /**
       * Fetch connected user's wallet balance of the provided token address.
       */
      if (!this.fund?.denominationToken?.address) {
        throw new Error("Fund denomination token is not available.")
      }
      const accountsStore = useAccountsStore();
      const activeAccount = accountsStore.activeAccount;
      if (!activeAccount) return console.error("Active account not found");

      const ERC20Contract = new this.web3.eth.Contract(ERC20, this.fund.denominationToken.address);
      const balanceWei = await ERC20Contract.methods.balanceOf(activeAccount).call();
      // const balanceWei = await this.fundFactoryContract.balanceOf(activeAccount);
      this.userFundBalance = ethers.formatEther(balanceWei);
      console.log(`user balance of ${this.fund?.denominationToken?.symbol} is ${this.userFundBalance}`);
    },
    async fetchUserFundUsdValue() {
      if (!this.fundContract) {
        // await this.fetchContract();
        await this.fetchUserBalance();
        if (!this.fundContract) return console.error("Contract not found");
      }

      const accountsStore = useAccountsStore();
      const activeAccount = accountsStore.activeAccount;
      if (!activeAccount) return console.error("Active account not found");

      let balanceWei = "0";
      try {
        balanceWei = await this.fundContract.valueOf(this.userBalance[this.selectedFundAddress]).toString();
      } catch (e) {
        console.log("The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error.");
      }
      console.log("balanceWei user fund usd value:", balanceWei);

      const value = ethers.formatEther(balanceWei);
      this.userFundUsdValue = value;
    },
    fetchFundBalance() {
      // mock data
      return "10000"
    },
  },
});
