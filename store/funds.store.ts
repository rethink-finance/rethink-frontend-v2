import { defineStore } from "pinia";
import { Web3 } from "web3";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import ERC20 from "~/assets/contracts/ERC20.json";
import addressesJson from "~/assets/contracts/addresses.json";
import { useAccountStore } from "~/store/account.store";
import { PositionType, PositionTypesMap } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type IFundSettings from "~/types/fund_settings";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type INAVUpdate from "~/types/nav_update";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IToken from "~/types/token";
import type IPositionTypeCount from "~/types/position_type";
import defaultAvatar from "@/assets/images/default_avatar.webp";
import { useFundStore } from "~/store/fund.store";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";

interface IState {
  funds: IFund[];
  cachedTokens: any,
}


export const useFundsStore = defineStore({
  id: "funds",
  state: (): IState => ({
    funds: [] as IFund[],
    cachedTokens: {
      "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063": {
        symbol: "DAI",
        decimals: 18,
      },
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": {
        symbol: "USDC",
        decimals: 6,
      },
    },
  }),
  getters: {
    fundStore(): any {
      return useFundStore();
    },
    web3Store(): any {
      return useWeb3Store();
    },
    web3(): Web3 {
      return this.web3Store.web3;
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
  },
  actions: {
    /**
     * Fetches specified information (e.g., 'symbol', 'decimals') about a token from a smart contract.
     * If the information is cached, it returns the cached value to avoid unnecessary blockchain calls.
     * Otherwise, it fetches the information using the specified contract method, caches it, and returns it.
     *
     * @param {Object} tokenContract - The web3 contract instance of the token.
     * @param {string} tokenAddress - The address of the token contract.
     * @param {string} infoType - The type of information to fetch from the token contract ('symbol' or 'decimals').
     * @returns {Promise<string|number>} - A promise that resolves with the token information (either a string for the symbol or a number for the decimals).
     */
    async getTokenInfo<T>(tokenContract: any, infoType: string, tokenAddress?: string): Promise<T | undefined> {
      if (!tokenAddress) return undefined;

      if (this.cachedTokens[tokenAddress] && this.cachedTokens[tokenAddress][infoType]) {
        return this.cachedTokens[tokenAddress][infoType];
      }
      const value = await tokenContract.methods[infoType]().call();
      this.cachedTokens[tokenAddress] = this.cachedTokens[tokenAddress] || {};
      this.cachedTokens[tokenAddress][infoType] = value;
      return value;
    },
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
    /**
     * Fetches multiple fund metadata such as:
     * - getFundStartTime
     * - fundMetadata
     */
    async fetchFundMetadata(fundSettings: IFundSettings) {
      // Fetch inception date
      const fundContract = new this.web3.eth.Contract(GovernableFund.abi, fundSettings.fundAddress);

      try {
        // @dev: would be better to just have this available in the FundSettings data.
        // Fetch base, fund and governance ERC20 token symbol and decimals.
        const fundBaseTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.baseToken);
        const fundTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.fundAddress);
        const governanceTokenContract = new this.web3.eth.Contract(ERC20, fundSettings.governanceToken);

        // Fetch all token symbols and decimals.
        // @dev: maybe there are more things to be fetched here.
        const [
          metaDataJson,
          baseTokenSymbol,
          baseTokenDecimals,
          governanceTokenSymbol,
          governanceTokenDecimals,
          fundTokenDecimals,
          fundTokenTotalSupply,
        ] = await Promise.all([
          fundContract.methods.fundMetadata().call() as Promise<string>,
          this.getTokenInfo<string>(fundBaseTokenContract, "symbol" , fundSettings.baseToken),
          this.getTokenInfo<number>(fundBaseTokenContract, "decimals", fundSettings.baseToken),
          this.getTokenInfo<string>(governanceTokenContract, "symbol" , fundSettings.governanceToken),
          this.getTokenInfo<number>(governanceTokenContract, "decimals", fundSettings.governanceToken),
          this.getTokenInfo<number>(fundTokenContract, "decimals", fundSettings.fundAddress),
          fundTokenContract.methods.totalSupply().call() as Promise<bigint>,
        ]);
        console.log("fundTokenTotalSupply: ", fundTokenTotalSupply)

        const fund: IFund = {
          chainName: this.web3Store.chainName,
          chainShort: this.web3Store.chainShort,
          chainIcon: this.web3Store.chainIcon,
          address: fundSettings.fundAddress || "",
          title: fundSettings.fundName || "N/A",
          subtitle: fundSettings.fundName || "N/A",
          description: "N/A",
          safeAddress: fundSettings.safe || "",
          governorAddress: fundSettings.governor || "",
          photoUrl: defaultAvatar,
          inceptionDate: "",
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
          totalNAVWei: BigInt("0"),
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
    async fetchFundsNAVMetadata(fundAddresses: string[]): Promise<Record<string, Partial<IFund>>> {
      /**
       * Fetch NAV data for each fund in fundAddresses and return partial fund with:
       * - inceptionDate
       * - totalNAVWei
       * - positionTypeCounts
       * - TODO: totalDepositBal (can get if needed)
       */
      const fundsNAVMetadata: Record<string, Partial<IFund>> = {};
      try {
        // @dev NOTE: the second parameter to getFundNavMetaData is navEntryIndex, but it is currently
        //  not used in the contract code, so I have set it to 0. Change this part in the future
        //  if the contract changes.
        const dataNAVs: Record<string, any[]> = await this.rethinkReaderContract.methods.getFundNavMetaData(
          fundAddresses, 0,
        ).call();

        // @dev NOTE: there is also: totalDepositBal for each fund if we need it.
        fundAddresses.forEach((address, index) => {
          const fundStartTime = dataNAVs.startTime[index];
          fundsNAVMetadata[address] = {
            inceptionDate: fundStartTime ? formatDate(new Date(Number(fundStartTime) * 1000)) : "",
            totalNAVWei: dataNAVs.totalNav[index],
            positionTypeCounts: [
              {
                type: PositionTypesMap[PositionType.Liquid],
                count: Number(dataNAVs.liquidLen[index] || 0),
              },
              {
                type: PositionTypesMap[PositionType.Composable],
                count: Number(dataNAVs.composableLen[index] || 0),
              },
              {
                type: PositionTypesMap[PositionType.NFT],
                count: Number(dataNAVs.nftLen[index] || 0),
              },
              {
                type: PositionTypesMap[PositionType.Illiquid],
                count: Number(dataNAVs.illiquidLen[index] || 0),
              },
            ] as IPositionTypeCount[],
          };
        })
        return fundsNAVMetadata;
      } catch (error) {
        console.error("Error calling getFundNavMetaData: ", error, "fund: ", fundAddresses);
        // Return an empty or default object in case of error
        return {} as Record<string, Partial<IFund>>;
      }
    },
    /**
     * Fetches all funds data from the GovernableFundFactory.
     */
    async fetchFunds() {
      console.log("fetchFunds");
      const fundFactoryContract = this.fundFactoryContract;
      const fundsLength = await fundFactoryContract.methods.registeredFundsLength().call();

      const fundsInfo = await fundFactoryContract.methods.registeredFundsData(0, fundsLength).call();
      const fundAddresses: string[] = fundsInfo[0];
      console.log(fundsInfo)

      // Reset funds as we will populate them with new data.
      this.funds = [];

      const promises = [];
      for (let i = 0; i < fundAddresses.length; i++) {
        const fundSettings: IFundSettings = this.fundStore.parseFundSettings(fundsInfo[1][i])
        promises.push(this.fetchFundMetadata(fundSettings))
      }

      try {
        const [fundsMetadata, fundsNAVMetadata] = await Promise.all([
          Promise.all(promises),
          this.fetchFundsNAVMetadata(fundAddresses),
        ]);

        // Merge funds metadata with NAV data.
        const funds = fundsMetadata.map(fund => {
          return {
            ...fund,
            ...(fundsNAVMetadata[fund.address] || {}),
          } as IFund
        })
        console.log("All funds: ", funds);

        // Using the spread operator to append each element
        this.funds.push(...funds);
      } catch (error) {
        console.error("Error fetching fund metadata:", error);
      }
    },
  },
});
