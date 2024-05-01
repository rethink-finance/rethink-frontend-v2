import { defineStore } from "pinia";
import { Web3 } from "web3";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import ERC20 from "~/assets/contracts/ERC20.json";
import addressesJson from "~/assets/contracts/addresses.json";
import { useAccountStore } from "~/store/account.store";
import { PositionType, PositionTypes, PositionTypesMap } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type INAVUpdate from "~/types/nav_update";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IToken from "~/types/token";
import type IPositionTypeCount from "~/types/position_type";
import defaultAvatar from "@/assets/images/default_avatar.webp";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";


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
  userBaseTokenBalance: bigint;
  userFundTokenBalance: bigint;
  userGovernanceTokenBalance: bigint;
  userFundAllowance: bigint;
  userFundShareValue: bigint

  selectedFundAddress: string;
}


export const useFundStore = defineStore({
  id: "fund",
  state: (): IState => ({
    fund: {} as IFund,
    userBaseTokenBalance: BigInt("0"),
    userFundTokenBalance: BigInt("0"),
    userGovernanceTokenBalance: BigInt("0"),
    userFundAllowance: BigInt("0"),
    userFundShareValue: BigInt("0"),
    selectedFundAddress: "",
  }),
  getters: {
    accountStore(): any {
      return useAccountStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): Web3 {
      return this.web3Store.web3;
    },
    baseToFundTokenExchangeRate(state: IState): number {
      if (!state.fund.fundTokenTotalSupply) return 0;
      return Number(state.fund.totalNAVWei / state.fund.fundTokenTotalSupply);
    },
    fundToBaseTokenExchangeRate(state: IState): number {
      if (!state.fund.totalNAVWei) return 0;
      return 1 / this.baseToFundTokenExchangeRate;
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
    // @ts-expect-error: we should extend the return type as Contract<...>
    rethinkReaderContract(): Contract {
      const contractAddress = addresses[RethinkReaderContractName][this.web3Store.chainId];
      return new this.web3.eth.Contract(RethinkReader.abi, contractAddress)
    },
    // @ts-expect-error: we should extend the return type as Contract<GovernableFund>...
    fundContract(): Contract {
      return new this.web3.eth.Contract(GovernableFund.abi, this.selectedFundAddress)
    },
    // @ts-expect-error: we should extend the return type ...
    fundBaseTokenContract(): Contract {
      return new this.web3.eth.Contract(ERC20, this.fund?.baseToken?.address)
    },
  },
  actions: {
    /**
     * Fetches all needed fund data..
     */
    async getFund(fundAddress: string) {
      this.selectedFundAddress = fundAddress;

      // TODO Check if fund already exists in the fetched fundsStore.funds.
      //   If yes, only fetch metadata & inception date, do not fetch fundSettings again, as we have it already.
      //   let fund = fundsStore.funds.find(f => f.fundAddress === fundAddress);
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
    /**
     * Fetches multiple fund data:
     * - getFundSettings
     * - getFundStartTime
     * - fundMetadata
     *
     * @dev: would be better to separate fundSettings from (startTime & metadata), as sometimes we already
     *   have the fund settings from the discovery page.
     */
    async fetchFundData() {
      // Fetch inception date
      const settingsData = await this.fundContract.methods.getFundSettings().call();
      // Process the fund settings with a method assumed to be available in the current scope
      const fundSettings: IFundSettings = this.parseFundSettings(settingsData);

      const fund = await this.fetchFundMetadata(fundSettings);
      fund.positionTypeCounts = await this.fetchFundNAVData(fundSettings.fundAddress);
      return fund;
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
      if (!this.accountStore.activeAccount?.address) return;

      return Promise.all([
        this.fetchUserBaseTokenBalance(),
        this.fetchUserFundTokenBalance(),
        this.fetchUserFundShareValue(),
        this.fetchUserFundAllowance(),
      ]);
    },
    /**
     * Fetches multiple fund metadata such as:
     * - getFundStartTime
     * - fundMetadata
     */
    async fetchFundMetadata(fundSettings: IFundSettings) {
      // Fetch inception date
      const fundContract = new this.web3.eth.Contract(GovernableFund.abi, fundSettings.fundAddress);
      const startTimePromise: Promise<string> = fundContract.methods.getFundStartTime().call();
      const metadataPromise: Promise<string> = fundContract.methods.fundMetadata().call();

      try {
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
          fundStartTime,
          metaDataJson,
          baseTokenSymbol,
          baseTokenDecimals,
          governanceTokenSymbol,
          governanceTokenDecimals,
          fundTokenDecimals,
          fundTokenTotalSupply,
          fundTotalNAV,
        ] = await Promise.all([
          startTimePromise,
          metadataPromise,
          fundBaseTokenContract.methods.symbol().call() as Promise<string>,
          fundBaseTokenContract.methods.decimals().call() as Promise<number>,
          governanceTokenContract.methods.symbol().call() as Promise<string>,
          governanceTokenContract.methods.decimals().call() as Promise<number>,
          fundTokenContract.methods.decimals().call() as Promise<number>,
          fundTokenContract.methods.totalSupply().call() as Promise<bigint>,
          fundContract.methods.totalNAV().call() as Promise<bigint>,
        ]);
        console.log("fundTokenTotalSupply: ", fundTokenTotalSupply)
        console.log("fundTotalNAV: ", fundTotalNAV)

        const fund: IFund = {
          chainName: this.accountStore.chainName,
          chainShort: this.accountStore.chainShort,
          chainIcon: this.accountStore.chainIcon,
          address: fundSettings.fundAddress || "",
          title: fundSettings.fundName || "N/A",
          subtitle: fundSettings.fundName || "N/A",
          description: "N/A",
          safeAddress: fundSettings.safe || "",
          governorAddress: fundSettings.governor || "",
          photoUrl: defaultAvatar,
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
          totalNAVWei: fundTotalNAV,
          fundTokenTotalSupply,
          cumulativeReturnPercent: 0,
          monthlyReturnPercent: 0,
          sharpeRatio: 0,
          positionTypeCounts: [] as IPositionTypeCount[],
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
          fund.photoUrl = metaData.photoUrl || defaultAvatar;
          fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
          fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
        }

        return fund;
      } catch (error) {
        console.error("Error in promises: ", error, "fund: ", fundSettings);
        return {} as IFund; // Return an empty or default object in case of error
      }
    },
    async fetchFundNAVData(fundAddress: string): Promise<IPositionTypeCount[]> {
      /**
       * Fetch fund NAV data.
       */
      try {
        const dataNAV = await this.rethinkReaderContract.methods.getNAVDataForFund(fundAddress).call();
        console.log("fund NAV: ", dataNAV)

        const positionTypeCounts = [];

        for (const [positionTypeKey, positionType] of PositionTypes) {
          const positionTypeData = dataNAV[positionTypeKey];
          // Get the last array for each NAV position type. The last array represents
          // the latest NAV update for each position type (liquid, nft, composable, illiquid).
          const lastIndex = positionTypeData?.length || 0;
          const lastNAVUpdate = positionTypeData[lastIndex - 1];
          positionTypeCounts.push({
            type: positionType,
            count: lastNAVUpdate?.length || 0,
          })
        }

        return positionTypeCounts;
      } catch (error) {
        console.error("Error calling getNAVDataForFund: ", error, "fund: ", fundAddress);
        // Return an empty or default object in case of error
        return [] as IPositionTypeCount[];
      }
    },
    /**
     * Fetches connected user's wallet balance of the base/denomination token.
     */
    async fetchUserBaseTokenBalance() {
      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token address is not available.")
      }
      const activeAccountAddress = this.accountStore.activeAccount.address;
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
      const activeAccountAddress = this.accountStore.activeAccount.address;
      if (!activeAccountAddress) throw new Error("Active account not found");

      this.userFundTokenBalance = await this.fundContract.methods.balanceOf(activeAccountAddress).call();

      console.log(`user fund token balance of ${this.fund?.fundToken?.symbol} is ${this.userFundTokenBalance}`);
      return this.userFundTokenBalance;
    },
    /**
     * Fetch connected user's fund allowance.
     * Amount of tokens the fund is allowed to act with (transfer/deposit/withdraw...).
     */
    async fetchUserFundAllowance() {
      if (!this.fund?.baseToken?.address) {
        throw new Error("Fund denomination token is not available.")
      }
      const activeAccountAddress = this.accountStore.activeAccount?.address
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
      const activeAccountAddress = this.accountStore.activeAccount.address;
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
