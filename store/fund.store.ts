import { BaseContract, ethers } from "ethers";
import { Web3 } from "web3";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import { useAccountsStore } from "~/store/accounts.store";
import { PositionType } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import addressesJson from "~/assets/contracts/addresses.json";
import type INAVUpdate from "~/types/nav_update";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IPositionType from "~/types/position_type";
import ERC20 from "~/assets/contracts/ERC20.json";
import type IToken from "~/types/token";

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


interface IState {
  fund: IFund;
  funds: IFund[];
  abi: Record<string, any>;
  address: Record<string, any>;
  apy: Record<string, any>;

  userBaseTokenBalance: bigint;
  userFundTokenBalance: bigint;
  userGovernanceTokenBalance: bigint;
  userFundAllowance: bigint;

  userFundTokenUsdValue: string
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
    userBaseTokenBalance: BigInt("0"),
    userFundTokenBalance: BigInt("0"),
    userGovernanceTokenBalance: BigInt("0"),
    userFundAllowance: BigInt("0"),
    userFundTokenUsdValue: "",
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
    web3(): Web3 {
      return this.web3Store.web3;
    },
    getFundAddress(state: IState): string {
      return state.address?.[state.selectedFundAddress];
    },
    /**
     * Contracts
     */
    // @ts-expect-error: we should extend the return type as Contract<GovernableFundFactory> but
    // for now we don't have types for each contract made, should be done using typechain or some
    // other type generator from abi.
    fundFactoryContract(): Contract {
      const contractAddress = addresses[GovernableFundFactoryContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(GovernableFundFactory.abi, contractAddress)
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund> but
    fundContract(): Contract {
      return new this.web3.eth.Contract(GovernableFund.abi, this.selectedFundAddress)
    },
    // @ts-expect-error: we should extend the return type ...
    fundBaseTokenContract(): Contract {
      return new this.web3.eth.Contract(ERC20, this.fund.baseToken.address)
    },
  },
  actions: {
    batchFetchFundSettings() {
      /** @dev: I tried many, many things to make this BatchRequest work with web3 4.x, this is the closest I came.
       * https://docs.web3js.org/guides/web3_upgrade_guide/x/#web3-batchrequest
       *       const batch = new this.web3.BatchRequest();
       *       // Define the request for getFundSettings
       *       const con = new this.web3.eth.Contract(GovernableFund.abi, this.selectedFundAddress);
       *       const getFundSettingsRequest: any = {
       *         jsonrpc: "2.0",
       *         id: 1,
       *         method: "eth_call",
       *         params: [{
       *           to: this.selectedFundAddress,
       *           data: con.methods.getFundSettings().encodeABI(),
       *         }, "latest"],
       *       };
       *
       *       // Add the request to the batch and capture the promise
       *       const getFundSettingsPromise = batch.add(getFundSettingsRequest);
       *
       *       // Execute the batch
       *       const rep = batch.execute();
       *       console.log("rep: ", rep);
       *
       *       // Handle the promise
       *       getFundSettingsPromise.then((response: any) => {
       *         console.log(response);
       *       }).catch((error: any) => {
       *         console.error("Error fetching getFundSettings:", error);
       *       });
       */
      console.error("not implemented");
    },
    parseFundSettings(fundData: any) {
      const fundSettings: Partial<IFundSettings> = {};

      // Directly iterate over the fund details object's entries.
      Object.entries(fundData).forEach(([key, value]) => {
        // Assume that every key in details corresponds to a valid key in IFundSettings.
        const detailKey = key as keyof IFundSettings;

        // Convert bigint values to strings, otherwise assign the value directly.
        // This approach skips checking if detailKey is explicitly part of fundSettings
        // since fundSettings is typed as Partial<IFundSettings> and initialized accordingly.
        fundSettings[detailKey] = typeof value === "bigint" ? value.toString() : value;
      });

      return fundSettings;
    },
    async fetchFundData() {
      /**
       * Fetch multiple fund data:
       * - getFundSettings
       * - getFundStartTime
       * - fundMetadata
       *
       * @dev: would be better to separate fundSettings from (startTime & metadata), as sometimes we already
       *   have the fund settings from the discovery page.
       */
      // Fetch inception date
      const settingsPromise = this.fundContract.methods.getFundSettings().call();
      const startTimePromise = this.fundContract.methods.getFundStartTime().call();
      const metadataPromise = this.fundContract.methods.fundMetadata().call();

      try {
        // Await all promises and destructure their resolved values
        const [settingsData, fundStartTime, metaDataJson] = await Promise.all([
          settingsPromise,
          startTimePromise,
          metadataPromise,
        ]);

        // Process the fund settings with a method assumed to be available in the current scope
        const fundSettings: Partial<IFundSettings> = this.parseFundSettings(settingsData);
        // Fetch Base/Base token symbol.
        // @dev: would be better to just have this available in the FundSettings data.
        const fundBaseTokenContract = new this.web3.eth.Contract(ERC20, settingsData?.baseToken);
        const fundTokenContract = new this.web3.eth.Contract(ERC20, settingsData?.fundAddress);
        const governanceTokenContract = new this.web3.eth.Contract(ERC20, settingsData?.governanceToken);

        // Fetch all token symbols and decimals.
        // @dev: maybe there are more things to be fetched here.
        const [
          baseTokenSymbol,
          baseTokenDecimals,
          governanceTokenSymbol,
          governanceTokenDecimals,
          fundTokenDecimals,
        ]= await Promise.all([
          fundBaseTokenContract.methods.symbol().call(),
          fundBaseTokenContract.methods.decimals().call(),
          governanceTokenContract.methods.symbol().call(),
          governanceTokenContract.methods.decimals().call(),
          fundTokenContract.methods.decimals().call(),
        ]);

        const fund: IFund = {
          address: fundSettings.fundAddress || "",
          title: fundSettings.fundName || "N/A",
          subtitle: fundSettings.fundName || "N/A",
          description: "N/A",
          safeAddress: fundSettings.safe || "",
          governorAddress: fundSettings.governor || "",
          // @dev: Default photo, we can replace it with some gray fund photo.
          photoUrl: "https://api.lorem.space/image/ai?w=60&h=60",
          inceptionDate: fundStartTime ? formatDate(new Date(Number(fundStartTime) * 1000)) : "",
          fundToken: {
            symbol: fundSettings.fundSymbol,
            address: fundSettings.fundAddress,
            decimals: fundTokenDecimals ?? 18,
          } as IToken,
          baseToken: {
            symbol: baseTokenSymbol ?? "",
            address: fundSettings.baseToken,
            decimals: baseTokenDecimals ?? 18,
          } as IToken,
          governanceToken: {
            symbol: governanceTokenSymbol ?? "",
            address: fundSettings.governanceToken,
            decimals: governanceTokenDecimals ?? 18,
          } as IToken,
          chain: "",
          aumValue: 0,
          cumulativeReturnPercent: 0,
          monthlyReturnPercent: 0,
          sharpeRatio: 0,
          userBaseTokenBalance: BigInt("0"),
          userFundTokenUsdValue: "",
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
          fundToBaseExchangeRate: 0,

          // My Fund Positions
          netDeposits: "",
          currentValue: "",
          totalReturn: 0,

          // Overview fields
          depositAddresses: [],
          managementAddresses: [],
          plannedSettlementPeriod: "",
          minLiquidAssetShare: "",

          // Governance
          votingDelay: "",
          votingPeriod: "",
          proposalThreshold: "",
          quorom: "",
          lateQuorom: "",

          // NAV Updates
          navUpdates: [] as INAVUpdate[],
        } as IFund;

        // Process metadata if available
        if (metaDataJson) {
          const metaData = JSON.parse(metaDataJson);
          console.log("fund metaData: ", metaData);
          fund.description = metaData.description;
          fund.photoUrl = metaData.photoUrl;
          fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
          fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
        }

        return fund;
      } catch (error) {
        console.error("Error in promises:", error);
        return {} as IFund; // Return an empty or default object in case of error
      }
    },
    async getFund(fundAddress: string) {
      /**
       * This function finds and returns fund in the funds array.
       */
      this.selectedFundAddress = fundAddress;

      // TODO Check if fund already exists in the fetched funds.
      //   If yes, only fetch metadata & inception date, do not fetch fundSettings again, as we have it already.
      // let fund = this.funds.find(f => f.fundAddress === fundAddress);
      try {
        // TODO only fetch fund if not found the fund
        this.fund = await this.fetchFundData() as IFund;
        console.log(this.fund)
        await this.fetchUserBaseTokenBalance();
      } catch (e) {
        console.error(`Failed fetching fund ${fundAddress} -> `, e)
      }

      if (!this.fund) {
        console.error(`Fund not found with address: ${fundAddress}`);
      }
    },
    async fetchFunds() {
      /**
       * This function fetches all funds data from the GovernableFundFactory.
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
        const fundSettings: Partial<IFundSettings> = this.parseFundSettings(fundsInfo[1][i])
        if (!this.fundsSettings[fundAddress]) {
          this.fundsSettings[fundAddress] = fundSettings as IFundSettings;
        }

        // TODO fix this data to be such as in the fetchFundData, reuse it.
        this.funds.push(
          {
            address: fundSettings.fundAddress || "",
            title: fundSettings.fundName || "N/A",
            subtitle: fundSettings.fundName || "N/A",
            description: fundSettings.fundName || "N/A",
            safeAddress: fundSettings.safe || "",
            governorAddress: fundSettings.governor || "",
            photoUrl: "https://api.lorem.space/image/ai?w=60&h=60",
            fundToken: {
              symbol: fundSettings.fundSymbol || "N/A",
              address: fundSettings.fundAddress || "N/A",
              decimals: 18,
            },
            baseToken: {
              symbol: "fundSettings.baseSymbol",
              address: fundSettings.baseToken,
              decimals: 18,
            },
            governanceToken: {
              symbol: "TODO", // TODO get governanceToken, same as getting baseToken symbol?
              address: fundSettings.governanceToken || "N/A",
              decimals: 18,
            },
            chain: "",
            inceptionDate: "",
            aumValue: 0,
            cumulativeReturnPercent: 0,
            monthlyReturnPercent: 0,
            sharpeRatio: 0,
            userBaseTokenBalance: BigInt("0"),
            userFundTokenUsdValue: "",
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
            fundToBaseExchangeRate: 0,

            // My Fund Positions
            netDeposits: "",
            currentValue: "",
            totalReturn: 0,

            // Overview fields
            depositAddresses: [],
            managementAddresses: [],
            plannedSettlementPeriod: "",
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
    async fetchUserBaseTokenBalance() {
      /**
       * Fetch connected user's wallet balance of the base/denomination token.
       */
      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token is not available.")
      }
      const activeAccountAddress = this.accountsStore.activeAccount.address;
      if (!activeAccountAddress) return console.error("Active account not found");

      this.userBaseTokenBalance = await this.fundBaseTokenContract.methods.balanceOf(activeAccountAddress).call();

      console.log(`user balance of ${this.fund?.baseToken?.symbol} is ${this.userBaseTokenBalance}`);
    },
    async fetchUserFundAllowance() {
      /**
       * Fetch connected user's fund allowance.
       * Amount of tokens the fund is allowed to act with (transfer/deposit/withdraw...).
       */
      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token is not available.")
      }
      const activeAccountAddress = this.accountsStore.activeAccount?.address
      if (!activeAccountAddress) return console.error("Active account not found");

      this.userFundAllowance = await this.fundBaseTokenContract.methods.allowance(
        activeAccountAddress, this.selectedFundAddress,
      ).call();

      console.log(`user allowance of ${this.fund?.baseToken?.symbol} is ${this.userFundAllowance}`);
    },
    async fetchUserFundUsdValue() {
      const activeAccount = this.accountsStore.activeAccount;
      if (!activeAccount) return console.error("Active account not found");

      let balanceWei = "0";
      try {
        balanceWei = await this.fundContract.valueOf(this.userFundTokenBalance).toString();
      } catch (e) {
        console.log("The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error.");
      }
      console.log("balanceWei user fund usd value:", balanceWei);

      const value = ethers.formatEther(balanceWei);
      this.userFundTokenUsdValue = value;
    },
    fetchFundBalance() {
      // mock data
      return "10000"
    },
  },
});
