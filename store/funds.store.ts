import defaultAvatar from "@/assets/images/default_avatar.webp";
import { defineStore } from "pinia";
import type { AbiInput } from "web3";
import { Web3 } from "web3";
import GovernableFund from "~/assets/contracts/GovernableFund.json";
import GovernableFundFactory from "~/assets/contracts/GovernableFundFactory.json";
import RethinkReader from "~/assets/contracts/RethinkReader.json";
import addressesJson from "~/assets/contracts/addresses.json";
import { useFundStore } from "~/store/fund.store";
import { useWeb3Store } from "~/store/web3.store";
import type IAddresses from "~/types/addresses";
import type ICyclePendingRequest from "~/types/cycle_pending_request";
import { PositionType, PositionTypesMap } from "~/types/enums/position_type";
import type IFund from "~/types/fund";
import type INAVMethod from "~/types/nav_method";
import type INAVUpdate from "~/types/nav_update";
import type IPositionTypeCount from "~/types/position_type";
import type IToken from "~/types/token";

// Since the direct import won't infer the custom type, we cast it here.:
const addresses: IAddresses = addressesJson as IAddresses;

const GovernableFundFactoryContractName = "GovernableFundFactoryBeaconProxy";
const RethinkReaderContractName = "RethinkReader";
const isExcludeFunds = true;
const isExcludeNAVDetails = true;


// interface
export interface IExcludeFundAddr {
  [chainId: string]: string[]
};

// interface
export interface IExcludeNAVDetailsHashes {
  [chainId: string]: string[]
};

/*
  @dev: TODO: MOVE BELOW TO FILE(s)
*/
const excludeFundAddrs = {
  "0x89": ["0x0657DC652F88B55Dd16f5D6cE687672264f9b61E", "0x8fAE33f10854c20a811246849A0d4131caf72125", "0x6DFbEE70f1250C2dECb3E9bCb2BE3AF19b15e631", "0xf48E3fa13cb2390e472cf1CA64F941eB7BD27475", "0x82CBA6D1A6dCeb408d7F048493262b83c9744f4D", "0xcfD904C4C857784686029995886d627da1aeFbe4", "0xe93CB20Fc113355753B6D237c3949E0452981dC3", "0x6edC5f675C5A20e867aeF0633033a17EA256637E", "0x920fdA0F59bDc852eD19e3ad975a808101ea2a29", "0x1550D564fEBE8c398F3cc398c9ac2a9e89E89A4F", "0x07094Bb5f175A4E6b074e5E79F6439a8A929533B", "0x98F1c2035680E4215cD5726a11279da96C07835F"],
  "0xa4b1": [],
  "0xfc": [],
  "0x1": [],
} as IExcludeFundAddr;

const excludeNAVDetailsHashes = {
  "0x89": [],
  "0xa4b1": [],
  "0xfc": [],
  "0x1": [],
} as IExcludeNAVDetailsHashes;

/*
  @dev: TODO: MOVE ABOVE TO FILE(s)
*/
interface IState {
  funds: IFund[];
  // All original NAV methods.
  allNavMethods: INAVMethod[],
  // Get the address of the original fund of all original NAV methods.
  navMethodDetailsHashToFundAddress: Record<string, string>,
}

export const useFundsStore = defineStore({
  id: "funds",
  state: (): IState => ({
    funds: [] as IFund[],
    allNavMethods: [] as INAVMethod[],
    navMethodDetailsHashToFundAddress: {} as Record<string, string>,
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
          if (isExcludeFunds) {
            let fieldName = this.web3Store.chainId as keyof IExcludeFundAddr;

            if (excludeFundAddrs[fieldName].indexOf(address) > -1) {
                return;
            }
          }

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
            fundTokenTotalSupply: BigInt("0"),
            baseToken: {
              address: "",  // Not important here.
              symbol: dataNAVs.fundBaseTokenSymbol[index],
              decimals: dataNAVs.fundBaseTokenDecimals[index],
            },
            governanceToken: {} as IToken,  // Not important here, for now.
            governanceTokenTotalSupply: BigInt("0"),
            totalNAVWei: dataNAVs.totalNav[index],
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
            quorumVotes: 0n,
            quorumVotesFormatted: "0",
            quorumNumerator: BigInt(0),
            quorumDenominator: BigInt(0),
            quorumPercentage: "N/A",
            lateQuorum: "",

            // Fees
            depositFee: "",
            depositFeeAddress: "",
            withdrawFee: "",
            withdrawFeeAddress: "",
            managementPeriod: "",
            managementFee: "",
            managementFeeAddress: "",
            performancePeriod: "",
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
      this.navMethodDetailsHashToFundAddress = {};

      console.log("allFundsNavData: ", allFundsNavData);
      const getNavEntryFunctionABI: AbiInput[] = GovernableFund.abi.find(
        func => func.name === "getNavEntry" && func.type === "function",
      )?.outputs || [];

      console.log("Fetch all NAV methods");
      for (const navData of allFundsNavData) {
        if (!navData.encodedNavUpdate?.length) continue;

        for (const encodedNavUpdate of navData.encodedNavUpdate) {
          try {
            // Decode NAV entry data.
            const navEntries: Record<string, any>[] = this.web3.eth.abi.decodeParameters(getNavEntryFunctionABI, encodedNavUpdate)[0] as any[];

            for (const [i, navEntry] of navEntries.entries()) {
              // Ignore NAV methods that are not original NAV entries.
              if (navEntry.isPastNAVUpdate || navEntry.pastNAVUpdateIndex !== 0n) {
                // console.log("[SKIP] navEntry: ", navEntry);
                continue;
              }
              // console.log("[KEEP] navEntry: ", navEntry);
              const parsedNavEntry: INAVMethod = this.fundStore.parseNAVEntry(navEntry);


              if (parsedNavEntry.detailsHash) {
                if (isExcludeNAVDetails) {
                  let chainID_ = this.web3Store.chainId as keyof IExcludeFundAddr;
                  if (excludeNAVDetailsHashes[chainID_].indexOf(parsedNavEntry.detailsHash) > -1) {
                      return;
                  }
                }
              }

              // Set the past NAV update entry fund address to the original fund address
              // the entry was created on.
              const fundAddress = fundAddresses[i];
              parsedNavEntry.pastNAVUpdateEntryFundAddress = fundAddress;
              allMethods.push(parsedNavEntry);
              if (parsedNavEntry.detailsHash) {
                this.navMethodDetailsHashToFundAddress[parsedNavEntry.detailsHash] = fundAddress;
              } else {
                console.error("Missing detailsHash for NAV entry ", navEntry);
              }
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
