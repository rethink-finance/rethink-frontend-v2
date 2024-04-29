import { BaseContract, ethers } from "ethers";
import { defineStore } from "pinia";
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
  userFundShareValue: bigint

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
    userFundShareValue: BigInt("0"),
    selectedFundAddress: "",
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

      return fundSettings as IFundSettings;
    },
    fetchUserBalances() {
      return Promise.all([
        this.fetchUserBaseTokenBalance(),
        this.fetchUserFundTokenBalance(),
        this.fetchUserFundShareValue(),
        this.fetchUserFundAllowance(),
      ]);
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
      const settingsData = await this.fundContract.methods.getFundSettings().call();
      // Process the fund settings with a method assumed to be available in the current scope
      const fundSettings: IFundSettings = this.parseFundSettings(settingsData);

      return await this.fetchFundMetadata(fundSettings);
    },
    async fetchFundMetadata(fundSettings: IFundSettings) {
      /**
       * Fetch multiple fund metadata such as:
       * - getFundStartTime
       * - fundMetadata
       */
      // Fetch inception date
      const fundContract = new this.web3.eth.Contract(GovernableFund.abi, fundSettings.fundAddress);
      const startTimePromise: Promise<string> = fundContract.methods.getFundStartTime().call();
      const metadataPromise: Promise<string> = fundContract.methods.fundMetadata().call();

      try {
        // Await all promises and destructure their resolved values
        const [fundStartTime, metaDataJson] = await Promise.all([
          startTimePromise,
          metadataPromise,
        ]);

        // @dev: would be better to just have this available in the FundSettings data.
        // Fetch base, fund and governance ERC20 token symbol and decimals.
        const fundBaseTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.baseToken);
        const fundTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.fundAddress);
        const governanceTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.governanceToken);

        // GovernableFund contract to get totalNAV.
        const fundContract = new this.web3.eth.Contract(GovernableFund.abi, fundSettings.fundAddress);

        // Fetch all token symbols and decimals.
        // @dev: maybe there are more things to be fetched here.
        const [
          baseTokenSymbol,
          baseTokenDecimals,
          governanceTokenSymbol,
          governanceTokenDecimals,
          fundTokenDecimals,
          fundTokenTotalSupply,
          fundTotalNAV,
        ] = await Promise.all([
          fundBaseTokenContract.methods.symbol().call() as Promise<string>,
          fundBaseTokenContract.methods.decimals().call() as Promise<number>,
          governanceTokenContract.methods.symbol().call() as Promise<string>,
          governanceTokenContract.methods.decimals().call() as Promise<number>,
          fundTokenContract.methods.decimals().call() as Promise<number>,
          fundTokenContract.methods.totalSupply().call() as Promise<number>,
          fundContract.methods.totalNAV().call() as Promise<number>,
        ]);
        console.log("fundTokenTotalSupply: ", fundTokenTotalSupply)
        console.log("fundTotalNAV: ", fundTotalNAV)

        const fund: IFund = {
          chainName: this.accountsStore.chainName,
          chainNativeToken: this.accountsStore.chainNativeToken,
          chainIcon: this.accountsStore.chainIcon,
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
          aumWei: fundTotalNAV,
          cumulativeReturnPercent: 0,
          monthlyReturnPercent: 0,
          sharpeRatio: 0,
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

          // My Fund Positions
          netDeposits: "",

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

          // Fees
          performaceHurdleRateBps: fundSettings.performaceHurdleRateBps,
          managementFee: fundSettings.managementFee,
          depositFee: fundSettings.depositFee,
          performanceFee: fundSettings.performanceFee,
          withdrawFee: fundSettings.withdrawFee,
          feeCollectors: fundSettings.feeCollectors,

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
        console.error("Error in promises: ", error, "fund: ", fundSettings);
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
        await this.fetchUserBalances();
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

      const promises = [];
      for (let i = 0; i < fundAddresses.length; i++) {
        const fundAddress: string = fundAddresses[i] as string;
        const fundSettings: IFundSettings = this.parseFundSettings(fundsInfo[1][i])
        if (!this.fundsSettings[fundAddress]) {
          this.fundsSettings[fundAddress] = fundSettings;
        }
        promises.push(this.fetchFundMetadata(fundSettings))
      }

      try {
        const fundsMetadata = await Promise.all(promises);
        console.log("All fund metadata:", fundsMetadata);
        // Using the spread operator to append each element
        this.funds.push(...fundsMetadata);
      } catch (error) {
        console.error("Error fetching fund metadata:", error);
      }
    },
    async fetchUserBaseTokenBalance() {
      /**
       * Fetch connected user's wallet balance of the base/denomination token.
       */
      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token address is not available.")
      }
      const activeAccountAddress = this.accountsStore.activeAccount.address;
      if (!activeAccountAddress) throw new Error("Active account not found");

      this.userBaseTokenBalance = await this.fundBaseTokenContract.methods.balanceOf(activeAccountAddress).call();

      console.log(`user base token balance of ${this.fund?.baseToken?.symbol} is ${this.userBaseTokenBalance}`);
      return this.userBaseTokenBalance;
    },
    async fetchUserFundTokenBalance() {
      /**
       * Fetch connected user's wallet balance of the fund token.
       */
      if (!this.fund?.fundToken?.address) {
        throw new Error("Fund token address is not available.")
      }
      const activeAccountAddress = this.accountsStore.activeAccount.address;
      if (!activeAccountAddress) throw new Error("Active account not found");

      this.userFundTokenBalance = await this.fundContract.methods.balanceOf(activeAccountAddress).call();

      console.log(`user fund token balance of ${this.fund?.fundToken?.symbol} is ${this.userFundTokenBalance}`);
      return this.userFundTokenBalance;
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

      console.log(`user fund allowance of ${this.fund?.baseToken?.symbol} is ${this.userFundAllowance}`);
      return this.userFundAllowance;
    },
    async fetchUserFundShareValue() {
      /**
       * Fetch user's fund share value (denominated in base token).
       */
      const activeAccountAddress = this.accountsStore.activeAccount.address;
      if (!activeAccountAddress) return console.error("Active account not found");

      let balanceWei = BigInt("0");
      try {
        balanceWei = await this.fundContract.methods.valueOf(activeAccountAddress).call();
      } catch (e) {
        console.error(
          "The total fund balance is probably 0, which is why MetaMask may be showing the 'Internal JSON-RPC... division by 0' error. -> ", e,
        );
      }
      console.log("balanceWei user fund share value:", balanceWei);

      this.userFundShareValue = balanceWei;
      return this.userFundShareValue;
    },
  },
});
