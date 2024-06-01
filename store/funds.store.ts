import { defineStore } from "pinia";
import {  Web3 } from "web3";
import type {  AbiInput } from "web3";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import addressesJson from "~/assets/contracts/addresses.json";
import { PositionType, PositionTypesMap } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type INAVUpdate from "~/types/nav_update";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import type IToken from "~/types/token";
import type IPositionTypeCount from "~/types/position_type";
import defaultAvatar from "@/assets/images/default_avatar.webp";
import { useFundStore } from "~/store/fund.store";
import type INAVMethod from "~/types/nav_method";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";

interface IState {
  funds: IFund[];
  allNavMethods: INAVMethod[],
}


export const useFundsStore = defineStore({
  id: "funds",
  state: (): IState => ({
    funds: [] as IFund[],
    allNavMethods: [] as INAVMethod[],
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
     * Fetch funds and their metadata and NAV data.
     * This will return funds with just enough data to populate the discover table.
     * More data can be fetched from fundSettings later if needed, or added to the reader contract.
     * - TODO: totalDepositBal (is also present if needed)
     */
    async fetchFundsMetadata(fundAddresses: string[], fundsInfo: any): Promise<IFund[]> {
      const funds: IFund[] = [];

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
          const fund: IFund = {
            chainName: this.web3Store.chainName,
            chainShort: this.web3Store.chainShort,
            address,
            title: dataNAVs.fundName[index] || "N/A",
            description: "N/A",
            safeAddress: "",
            governorAddress: "",
            photoUrl: defaultAvatar,
            inceptionDate: fundStartTime ? formatDate(new Date(Number(fundStartTime) * 1000)) : "",
            fundToken: {
              symbol: fundsInfo[address].fundSymbol,
              address,
              decimals: -1,
            } as IToken,
            baseToken: {
              address: "",  // Not important here.
              symbol: dataNAVs.fundBaseTokenSymbol[index],
              decimals: dataNAVs.fundBaseTokenDecimals[index],
            },
            governanceToken: {} as IToken,  // Not important here, for now.
            totalNAVWei: dataNAVs.totalNav[index],
            fundTokenTotalSupply: BigInt("0"),
            cumulativeReturnPercent: 0,
            monthlyReturnPercent: 0,
            sharpeRatio: 0,
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
            quorum: "",
            lateQuorum: "",

            // Fees
            depositFee: "",
            depositFeeAddress: "",
            withdrawFee: "",
            withdrawFeeAddress: "",
            managementFee: "",
            managementFeeAddress: "",
            performanceFee: "",
            performanceFeeAddress: "",
            performaceHurdleRateBps: "",
            feeCollectors: [],

            // NAV Updates
            navUpdates: [] as INAVUpdate[],
          };

          const metaDataJson = dataNAVs.fundMetadata[index];
          // Process metadata if available
          if (metaDataJson) {
            const metaData = JSON.parse(metaDataJson);
            fund.description = metaData.description;
            fund.photoUrl = metaData.photoUrl || defaultAvatar;
            fund.plannedSettlementPeriod = metaData.plannedSettlementPeriod;
            fund.minLiquidAssetShare = metaData.minLiquidAssetShare;
          }
          funds.push(fund);
        })
        return funds;
      } catch (error) {
        console.error("Error calling getFundNavMetaData: ", error, " addresses: ", fundAddresses);
        return funds;
      }
    },
    async fetchFundsInfoArrays() {
      const fundFactoryContract = this.fundFactoryContract;
      const fundsLength = await fundFactoryContract.methods.registeredFundsLength().call();

      return await fundFactoryContract.methods.registeredFundsData(0, fundsLength).call();
    },
    /**
     * Fetches all funds data from the GovernableFundFactory.
     */
    async fetchFunds() {
      console.log("fetchFunds");
      // Reset funds as we will populate them with new data.
      this.funds = [];

      const fundsInfoArrays = await this.fetchFundsInfoArrays();
      const fundAddresses: string[] = fundsInfoArrays[0];
      const fundsInfo = Object.fromEntries(fundAddresses.map((address, index) => [address, fundsInfoArrays[1][index]]));

      const funds = await this.fetchFundsMetadata(fundAddresses, fundsInfo);
      console.log("All funds: ", funds);

      // Using the spread operator to append each element
      this.funds.push(...funds);

      // Fetch all possible NAV methods for all funds
      this.fetchAllNavMethods(fundAddresses);
    },
    /**
     * Fetches all NAV methods
     */
    async fetchAllNavMethods(fundAddresses: string[]) {
      const allFundsNavData = await this.fundStore.rethinkReaderContract.methods.bulkGetNavData(fundAddresses).call();
      const allMethods: INAVMethod[] = [];
      console.log("allFundsNavData: ", allFundsNavData);
      const getNavEntryFunctionABI: AbiInput[] = GovernableFund.abi.find(
        func => func.name === "getNavEntry" && func.type === "function",
      )?.outputs || [];

      for (const navData of allFundsNavData) {
        if (!navData.encodedNavUpdate?.length) continue;
        for (const encodedNavUpdate of navData.encodedNavUpdate) {

          try {
            // Decode NAV entry data.
            const navEntries: Record<string, any>[] = this.web3.eth.abi.decodeParameters(getNavEntryFunctionABI, encodedNavUpdate)[0] as any[];

            for (const navEntry of navEntries) {
              // Ignore NAV methods that are not original NAV entries.
              if (navEntry.isPastNAVUpdate || navEntry.pastNAVUpdateIndex !== 0n) continue;
              console.log("navEntry: ", navEntry);
              allMethods.push(this.fundStore.parseNAVEntry(navEntry))
            }
          } catch (error: any) {
            console.log("error processing all NAV methods: ", error)
          }
        }
        console.log("allMethods: ", allMethods)
      }

      this.allNavMethods = allMethods;
    },
  },
});
